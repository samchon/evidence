package evidence

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// swaggerCacheLimit bounds the cache so a resident host cannot grow without
// end. A project configures a handful of Swagger documents, not hundreds, so
// this is a backstop against a pathological configuration rather than a tuning
// knob — and the oldest entry is dropped rather than the whole map cleared, so
// a project sitting exactly on the limit still gets hits.
const swaggerCacheLimit = 64

// swaggerDocuments remembers normalized operations by document content.
//
// This is the rule's own state, not the project state the host publishes. The
// lint-rule-authoring skill forbids caching a `SetState` value across Program
// cycles because the host owns that wrapper's lifetime; nothing there governs
// memory a rule keeps for itself, and the parallel walk never reaches this
// because a project rule runs before any file rule. The mutex is not for that
// walk — it is because a resident host may hold several projects at once, and
// paying for a lock on a path that skips a process spawn is not a trade worth
// thinking about.
var swaggerDocuments = &swaggerCache{entries: map[string][]swaggerOperation{}}

type swaggerCache struct {
	mutex   sync.Mutex
	entries map[string][]swaggerOperation
	order   []string
}

func (cache *swaggerCache) lookup(digest string) ([]swaggerOperation, bool) {
	if digest == "" {
		return nil, false
	}
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	operations, hit := cache.entries[digest]
	if !hit {
		return nil, false
	}
	// Copied out because the caller builds units from it while another cycle
	// may be reading the same entry.
	return append([]swaggerOperation(nil), operations...), true
}

func (cache *swaggerCache) store(digest string, operations []swaggerOperation) {
	if digest == "" {
		return
	}
	cache.mutex.Lock()
	defer cache.mutex.Unlock()
	if _, exists := cache.entries[digest]; exists {
		return
	}
	if len(cache.order) >= swaggerCacheLimit {
		delete(cache.entries, cache.order[0])
		cache.order = cache.order[1:]
	}
	cache.entries[digest] = append([]swaggerOperation(nil), operations...)
	cache.order = append(cache.order, digest)
}

// swaggerContentDigests hashes each local source's bytes.
//
// The digest is the whole cache key, which is what makes staleness structural
// rather than improbable: identical bytes normalize to identical operations, so
// a hit can only return what the current file means. An edit, a truncation, or
// a same-length replacement all change the digest and miss. A missing or
// unreadable file yields no digest and is normalized as before, which keeps the
// normalizer's own diagnostic for it.
//
// An HTTP(S) source never participates. A URL has no validator without a
// fetch, and the fetch is most of what the normalizer costs, so a remote
// document cannot be shown unchanged without paying the price of finding out.
// That half needs the external-input policy tracked upstream.
func swaggerContentDigests(root string, sources []string) map[string]string {
	digests := map[string]string{}
	for _, source := range sources {
		digest := swaggerContentDigest(root, source)
		if digest != "" {
			digests[source] = digest
		}
	}
	return digests
}

func swaggerContentDigest(root string, source string) string {
	if isRemoteSwaggerSource(source) {
		return ""
	}
	content, err := os.ReadFile(swaggerSourcePath(root, source))
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func isRemoteSwaggerSource(source string) bool {
	lowered := strings.ToLower(source)
	return strings.HasPrefix(lowered, "http://") ||
		strings.HasPrefix(lowered, "https://")
}

func swaggerSourcePath(root string, source string) string {
	return filepath.Join(root, filepath.FromSlash(source))
}

// rememberSwaggerDocument records a normalization result under the content it
// came from, and only when that content held still around the normalizer.
//
// The digest is taken again afterwards because the normalizer reads the file
// itself, in another process, after this one read it. Storing on the first
// digest alone would let a write landing inside that window bind one document's
// operations to another document's bytes — a hit that returns a stale answer
// forever, which is the one failure a cache must not be able to produce.
func rememberSwaggerDocument(
	root string,
	document swaggerDocumentInventory,
	digest string,
) {
	if digest == "" {
		return
	}
	if swaggerContentDigest(root, document.Source) != digest {
		return
	}
	swaggerDocuments.store(digest, document.Operations)
}

// swaggerUnitsFromCache rebuilds one source's units from remembered operations.
//
// Units are rebuilt per source rather than remembered, because a unit carries
// its source in its identity while the operations do not. That is also what
// lets two sources holding identical bytes share one entry: what was cached is
// a property of the document, not of where it was found.
func swaggerUnitsFromCache(
	inventories map[string]*artifactInventory,
	cached map[string][]swaggerOperation,
) []string {
	problems := []string{}
	for source, operations := range cached {
		inventory := inventories[source]
		if inventory == nil {
			continue
		}
		for _, operation := range operations {
			unit, problem := swaggerOperationUnit(source, operation)
			if problem != "" {
				inventory.Problems = append(inventory.Problems, inventoryProblem{
					Symbol:  "operation",
					Message: problem,
				})
				problems = append(problems, problem)
				continue
			}
			inventory.Units = append(inventory.Units, unit)
		}
		sortUnits(inventory.Units)
	}
	return problems
}
