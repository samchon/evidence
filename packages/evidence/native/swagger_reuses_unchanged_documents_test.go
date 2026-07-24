package evidence

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const swaggerCacheDocument = `{"openapi":"3.1.0","paths":{"/members":{"post":{}}}}`

// isolateSwaggerCache gives one test its own empty cache and restores the
// shared one afterwards.
//
// The cache outlives a Program cycle on purpose, so without this a test could
// answer from an entry another test stored — and, worse, could silence an
// existing case that proves the normalizer runs. Order dependence between tests
// is exactly the failure a cross-cycle cache invites.
func isolateSwaggerCache(t *testing.T) *swaggerCache {
	t.Helper()
	previous := swaggerDocuments
	swaggerDocuments = &swaggerCache{entries: map[string][]swaggerOperation{}}
	t.Cleanup(func() { swaggerDocuments = previous })
	return swaggerDocuments
}

// warmSwaggerCache remembers one document's operations under the bytes
// currently on disk, without running the normalizer.
func warmSwaggerCache(t *testing.T, root string, source string) {
	t.Helper()
	digest := swaggerContentDigest(root, source)
	if digest == "" {
		t.Fatalf("fixture source %q must hash", source)
	}
	swaggerDocuments.store(digest, []swaggerOperation{
		{Method: "post", Path: "/members"},
	})
}

func swaggerCacheConfig(t *testing.T, sources ...string) graphConfig {
	t.Helper()
	references := make([]string, 0, len(sources))
	for _, source := range sources {
		references = append(
			references,
			`{"type":"swagger","file":"`+source+`"}`,
		)
	}
	return decodeInventoryConfig(t, `{"claims":[{
		"type":"typescript",
		"files":["src/**"],
		"reference":[`+strings.Join(references, ",")+`]
	}]}`)
}

func swaggerTargets(inventory *artifactInventory) []string {
	targets := []string{}
	for _, unit := range inventory.Units {
		targets = append(targets, unit.ID)
	}
	return targets
}

/**
 * Verifies an unchanged document is answered from memory without starting the
 * normalizer.
 *
 * This is the whole point of the cache: a resident host re-runs the graph on
 * every rebuild, and re-normalizing a document nobody touched costs a Node
 * process start — roughly a third of a second, paid the same for a three-
 * operation document as for a two-hundred-operation one.
 *
 * The proof is the unusable binary, as elsewhere in this suite: a spawn that
 * happens fails loudly, so silence is evidence that none was attempted rather
 * than evidence that one succeeded quietly.
 *
 *  1. Remember a document under the bytes on disk.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the operations materialize with no problem reported.
 */
func TestSwaggerReusesAnUnchangedDocumentWithoutSpawning(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
	warmSwaggerCache(t, root, "swagger.json")

	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
	if len(problems) != 0 {
		t.Fatalf("an unchanged document must not start the normalizer, got: %v", problems)
	}
	targets := swaggerTargets(inventories["swagger.json"])
	if len(targets) != 1 || targets[0] != "swagger:swagger.json:POST:/members" {
		t.Fatalf("cached operations must rebuild the same units, got %v", targets)
	}
}

/**
 * Verifies an edited document is not answered from memory.
 *
 * The negative twin of the case above, and the one that matters: a stale
 * inventory is not a slow build, it is a green build that should have failed —
 * a heading or an operation deleted from a source while every citation to it
 * still reports as satisfied.
 *
 *  1. Remember a document, then rewrite the file with different bytes.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted, proving the entry was not used.
 */
func TestSwaggerDoesNotReuseAnEditedDocument(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
	warmSwaggerCache(t, root, "swagger.json")

	rewritten := `{"openapi":"3.1.0","paths":{"/members":{"post":{}},"/orders":{"get":{}}}}`
	if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(rewritten), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	_, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
	if len(problems) == 0 {
		t.Fatal("an edited document must be re-normalized, not answered from memory")
	}
}

/**
 * Verifies a replacement of exactly the same length is not answered from
 * memory.
 *
 * This is the hole a size-and-timestamp key leaves open, and the reason the key
 * is the content itself. An operation renamed to another of equal length, saved
 * inside one filesystem timestamp tick, changes what the document means while
 * changing neither its size nor, on a coarse clock, its modification time.
 *
 *  1. Remember a document, then rewrite it with different bytes of equal length.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted.
 */
func TestSwaggerDoesNotReuseASameLengthReplacement(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
	warmSwaggerCache(t, root, "swagger.json")

	replacement := `{"openapi":"3.1.0","paths":{"/members":{"put!":{}}}}`
	if len(replacement) != len(swaggerCacheDocument) {
		t.Fatalf("fixture must be the same length: %d vs %d", len(replacement), len(swaggerCacheDocument))
	}
	if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(replacement), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	_, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
	if len(problems) == 0 {
		t.Fatal("a same-length replacement must be re-normalized")
	}
}

/**
 * Verifies a deleted document is not answered from memory.
 *
 * A source that vanished has no bytes to hash, so it cannot hit — and it must
 * still reach the normalizer, because the diagnostic a reader needs is the one
 * naming the missing file, not silence.
 *
 *  1. Remember a document, then delete the file.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted.
 */
func TestSwaggerDoesNotReuseADeletedDocument(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
	warmSwaggerCache(t, root, "swagger.json")

	if err := os.Remove(filepath.Join(root, "swagger.json")); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	_, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
	if len(problems) == 0 {
		t.Fatal("a deleted document must still reach the normalizer for its diagnostic")
	}
}

/**
 * Verifies two sources holding identical bytes share one entry, each keeping
 * its own unit identity.
 *
 * What is remembered is a property of the document, not of where it was found,
 * so the key is the content alone. Units are rebuilt per source because a unit
 * carries its source in its identity — sharing the entry must not make one
 * source answer under the other's name.
 *
 *  1. Remember one document, then declare a second file with identical bytes.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load both.
 *  3. Assert both hit and each unit names its own source.
 */
func TestSwaggerSharesOneEntryAcrossIdenticalDocuments(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "first.json", swaggerCacheDocument)
	if err := os.WriteFile(filepath.Join(root, "second.json"), []byte(swaggerCacheDocument), 0o644); err != nil {
		t.Fatal(err)
	}
	warmSwaggerCache(t, root, "first.json")

	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	inventories, problems := loadSwaggerInventories(
		root,
		swaggerCacheConfig(t, "first.json", "second.json"),
	)
	if len(problems) != 0 {
		t.Fatalf("identical bytes must share one entry, got: %v", problems)
	}
	for _, source := range []string{"first.json", "second.json"} {
		targets := swaggerTargets(inventories[source])
		want := "swagger:" + source + ":POST:/members"
		if len(targets) != 1 || targets[0] != want {
			t.Fatalf("source %q must keep its own identity, got %v", source, targets)
		}
	}
}

/**
 * Verifies a remote document never answers from memory.
 *
 * A URL has no validator without a fetch, and the fetch is most of what the
 * normalizer costs — so a remote source cannot be shown unchanged without
 * paying the price of finding out. Excluding it is what keeps the cache honest
 * rather than merely fast.
 *
 * This pins the behavior, not the branch that produces it. Deleting the remote
 * check alone leaves this case passing, because a URL-shaped path fails to read
 * and yields no key either way; the explicit check is the reason rather than
 * the accident, and `isRemoteSwaggerSource` is pinned separately below.
 *
 *  1. Store an entry under the digest of a local file with the same content.
 *  2. Declare an HTTP source and point the bridge at an unusable binary.
 *  3. Assert the normalizer was attempted.
 */
func TestSwaggerNeverReusesARemoteDocument(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
	warmSwaggerCache(t, root, "swagger.json")

	if digest := swaggerContentDigest(root, "https://example.com/swagger.json"); digest != "" {
		t.Fatalf("a remote source must not hash to a cache key, got %q", digest)
	}
	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	_, problems := loadSwaggerInventories(
		root,
		swaggerCacheConfig(t, "https://example.com/swagger.json"),
	)
	if len(problems) == 0 {
		t.Fatal("a remote source must always be fetched, never answered from memory")
	}
}

/**
 * Verifies which sources are classified as remote.
 *
 * The loader's own case above cannot isolate this, so the classifier is pinned
 * directly. Scheme matching is case-insensitive because a configuration is
 * hand-written, and a path merely containing the text is local — the graph's
 * own configuration decoder already refuses anything ambiguous, so this only
 * has to agree with it.
 *
 *  1. Classify http and https sources in mixed case.
 *  2. Classify local paths, including one that merely mentions a scheme.
 *  3. Assert only the true URLs are remote.
 */
func TestSwaggerClassifiesRemoteSources(t *testing.T) {
	for _, source := range []string{
		"http://example.com/swagger.json",
		"https://example.com/swagger.json",
		"HTTPS://EXAMPLE.COM/swagger.json",
	} {
		if !isRemoteSwaggerSource(source) {
			t.Fatalf("%q must be remote", source)
		}
	}
	for _, source := range []string{
		"swagger.json",
		"docs/https-swagger.json",
		"packages/api/openapi.yaml",
	} {
		if isRemoteSwaggerSource(source) {
			t.Fatalf("%q must be local", source)
		}
	}
}

/**
 * Verifies a mixed graph re-normalizes only what changed.
 *
 * One spawn serves every source in a cycle, so a single miss pays the process
 * start for all of them unless the request is narrowed. Sending only the misses
 * is what keeps one edited document from costing the others their entries.
 *
 *  1. Remember two documents, then edit one of them.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load both.
 *  3. Assert only the edited source is reported.
 */
func TestSwaggerRenormalizesOnlyTheChangedSource(t *testing.T) {
	isolateSwaggerCache(t)
	root := writeInventoryFixture(t, "stable.json", swaggerCacheDocument)
	if err := os.WriteFile(filepath.Join(root, "volatile.json"), []byte(swaggerCacheDocument), 0o644); err != nil {
		t.Fatal(err)
	}
	warmSwaggerCache(t, root, "stable.json")

	edited := `{"openapi":"3.1.0","paths":{"/orders":{"get":{}}}}`
	if err := os.WriteFile(filepath.Join(root, "volatile.json"), []byte(edited), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
	inventories, problems := loadSwaggerInventories(
		root,
		swaggerCacheConfig(t, "stable.json", "volatile.json"),
	)
	if len(problems) == 0 {
		t.Fatal("the edited source must be re-normalized")
	}
	for _, problem := range problems {
		if strings.Contains(problem, "stable.json") {
			t.Fatalf("the unchanged source must not be re-normalized, got: %v", problems)
		}
	}
	if len(inventories["stable.json"].Units) != 1 {
		t.Fatalf("the unchanged source must keep its units, got %d", len(inventories["stable.json"].Units))
	}
}

/**
 * Verifies the cache is bounded and drops its oldest entry first.
 *
 * A resident host lives for days, and a configuration that rewrites a document
 * under a new digest every cycle would otherwise grow this map without end.
 * Dropping the oldest rather than clearing keeps a project sitting exactly on
 * the limit still hitting.
 *
 *  1. Store one more document than the limit allows.
 *  2. Assert the first is gone and the last is present.
 *  3. Assert the map never exceeds the limit.
 */
func TestSwaggerCacheIsBoundedAndEvictsTheOldest(t *testing.T) {
	cache := isolateSwaggerCache(t)
	for index := 0; index <= swaggerCacheLimit; index++ {
		cache.store(
			"digest-"+decimal(index),
			[]swaggerOperation{{Method: "get", Path: "/" + decimal(index)}},
		)
	}
	if _, hit := cache.lookup("digest-0"); hit {
		t.Fatal("the oldest entry must be evicted once the limit is passed")
	}
	if _, hit := cache.lookup("digest-" + decimal(swaggerCacheLimit)); !hit {
		t.Fatal("the newest entry must be kept")
	}
	if len(cache.entries) > swaggerCacheLimit {
		t.Fatalf("the cache must stay bounded, got %d entries", len(cache.entries))
	}
}

/**
 * Verifies a lookup hands back a copy.
 *
 * A caller builds units from the returned slice while another Program cycle may
 * be reading the same entry. Returning the stored slice would let one cycle's
 * caller corrupt what every later cycle answers with, which no test of the
 * loader itself would notice.
 *
 *  1. Store one operation and read it back.
 *  2. Overwrite the returned slice.
 *  3. Assert a second lookup is unaffected.
 */
func TestSwaggerCacheLookupReturnsACopy(t *testing.T) {
	cache := isolateSwaggerCache(t)
	cache.store("digest", []swaggerOperation{{Method: "post", Path: "/members"}})

	first, hit := cache.lookup("digest")
	if !hit {
		t.Fatal("the stored entry must be found")
	}
	first[0] = swaggerOperation{Method: "delete", Path: "/wrong"}

	second, hit := cache.lookup("digest")
	if !hit {
		t.Fatal("the stored entry must still be found")
	}
	if second[0].Method != "post" || second[0].Path != "/members" {
		t.Fatalf("a caller must not be able to corrupt the entry, got %+v", second[0])
	}
}
