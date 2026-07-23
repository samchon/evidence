package evidence

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

const swaggerBridgeTimeout = 60 * time.Second
const swaggerBridgeOutputLimit = 64 * 1024 * 1024
const swaggerBridgeErrorLimit = 64 * 1024

const swaggerBridgeScript = `
const path = require("node:path");
const { createRequire } = require("node:module");

const root = process.argv[1];
const projectRequire = createRequire(path.join(root, "package.json"));
const manifest = projectRequire.resolve("@samchon/evidence-graph/package.json");
const pluginRequire = createRequire(manifest);
const normalizer = pluginRequire(
  path.join(path.dirname(manifest), "lib", "internal", "loadSwaggerOperations.js"),
);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const result = await normalizer.loadSwaggerOperations(JSON.parse(input));
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
`

type swaggerNormalizationRequest struct {
	Root    string   `json:"root"`
	Sources []string `json:"sources"`
}

type swaggerNormalizationResult struct {
	Documents []swaggerDocumentInventory `json:"documents"`
	Problems  []swaggerDocumentProblem   `json:"problems"`
}

type swaggerDocumentInventory struct {
	Source     string             `json:"source"`
	Operations []swaggerOperation `json:"operations"`
}

type swaggerDocumentProblem struct {
	Source  string `json:"source"`
	Message string `json:"message"`
}

type swaggerOperation struct {
	Method string `json:"method"`
	Path   string `json:"path"`
}

func loadSwaggerInventories(
	root string,
	config graphConfig,
) (map[string]*artifactInventory, []string) {
	sources := configuredSwaggerSources(config)
	inventories := map[string]*artifactInventory{}
	for _, source := range sources {
		inventories[source] = &artifactInventory{
			Path: source,
			Type: artifactSwagger,
		}
	}
	if len(sources) == 0 {
		return inventories, nil
	}

	result, err := normalizeSwaggerSources(root, sources)
	if err != nil {
		message := "Evidence graph could not run its Swagger normalizer: " + err.Error() + ". Swagger references require Node.js and the installed @typia/interface, @typia/utils, and yaml dependencies."
		for _, inventory := range inventories {
			inventory.Problems = append(inventory.Problems, inventoryProblem{
				Symbol:  "operation",
				Message: message,
			})
		}
		return inventories, []string{message}
	}

	problems := []string{}
	seen := map[string]bool{}
	for _, document := range result.Documents {
		inventory := inventories[document.Source]
		if inventory == nil {
			problems = append(
				problems,
				"Evidence graph Swagger normalizer returned an unconfigured source '"+displaySwaggerSource(document.Source)+"'. Reinstall @samchon/evidence-graph; the native and JavaScript bridge contracts disagree.",
			)
			continue
		}
		if seen[document.Source] {
			problems = append(
				problems,
				"Evidence graph Swagger normalizer returned source '"+displaySwaggerSource(document.Source)+"' more than once. Reinstall @samchon/evidence-graph; the native and JavaScript bridge contracts disagree.",
			)
			continue
		}
		seen[document.Source] = true
		for _, operation := range document.Operations {
			unit, problem := swaggerOperationUnit(document.Source, operation)
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
	for _, problem := range result.Problems {
		inventory := inventories[problem.Source]
		if inventory == nil {
			problems = append(
				problems,
				"Evidence graph Swagger normalizer rejected an unconfigured source '"+displaySwaggerSource(problem.Source)+"'. Reinstall @samchon/evidence-graph; the native and JavaScript bridge contracts disagree.",
			)
			continue
		}
		seen[problem.Source] = true
		message := "Evidence graph could not normalize Swagger source '" + displaySwaggerSource(problem.Source) + "' to @typia/interface OpenApi.IDocument: " + strings.TrimSpace(problem.Message) + ". Fix the file or URL so @typia/utils can upgrade it."
		inventory.Problems = append(inventory.Problems, inventoryProblem{
			Symbol:  "operation",
			Message: message,
		})
		problems = append(problems, message)
	}
	for _, source := range sources {
		if seen[source] {
			continue
		}
		message := "Evidence graph Swagger normalizer returned no result for '" + displaySwaggerSource(source) + "'. Reinstall @samchon/evidence-graph; the native and JavaScript bridge contracts disagree."
		inventories[source].Problems = append(
			inventories[source].Problems,
			inventoryProblem{Symbol: "operation", Message: message},
		)
		problems = append(problems, message)
	}
	return inventories, problems
}

func configuredSwaggerSources(config graphConfig) []string {
	unique := map[string]bool{}
	sources := []string{}
	for _, claim := range config.Claims {
		for _, reference := range claim.References {
			if reference.Type != artifactSwagger {
				continue
			}
			if unique[reference.Source] {
				continue
			}
			unique[reference.Source] = true
			sources = append(sources, reference.Source)
		}
	}
	sort.Strings(sources)
	return sources
}

func normalizeSwaggerSources(
	root string,
	sources []string,
) (swaggerNormalizationResult, error) {
	request, err := json.Marshal(swaggerNormalizationRequest{
		Root:    root,
		Sources: sources,
	})
	if err != nil {
		return swaggerNormalizationResult{}, err
	}
	node := os.Getenv("TTSC_NODE_BINARY")
	if node == "" {
		node, err = exec.LookPath("node")
		if err != nil {
			return swaggerNormalizationResult{}, errors.New("Node.js executable was not found")
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), swaggerBridgeTimeout)
	defer cancel()
	command := exec.CommandContext(ctx, node, "-e", swaggerBridgeScript, root)
	command.Dir = root
	command.Stdin = bytes.NewReader(request)
	stdout := &limitedBuffer{Limit: swaggerBridgeOutputLimit}
	stderr := &limitedBuffer{Limit: swaggerBridgeErrorLimit}
	command.Stdout = stdout
	command.Stderr = stderr
	if err := command.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return swaggerNormalizationResult{}, errors.New("Swagger normalizer exceeded its 60 second timeout")
		}
		detail := strings.TrimSpace(stderr.String())
		if detail == "" {
			detail = err.Error()
		}
		return swaggerNormalizationResult{}, errors.New(detail)
	}
	var result swaggerNormalizationResult
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return swaggerNormalizationResult{}, errors.New("Swagger normalizer returned invalid JSON: " + err.Error())
	}
	return result, nil
}

func swaggerOperationUnit(
	source string,
	operation swaggerOperation,
) (*evidenceUnit, string) {
	method := strings.TrimSpace(operation.Method)
	operationPath := operation.Path
	if method == "" || strings.ContainsAny(method, ":\t\r\n ") {
		return nil, "Swagger source '" + displaySwaggerSource(source) + "' contains an operation method that cannot form a '<METHOD>:<path>' evidence target."
	}
	if !strings.HasPrefix(operationPath, "/") || containsWhitespace(operationPath) {
		return nil, "Swagger source '" + displaySwaggerSource(source) + "' contains operation path '" + operationPath + "', which cannot form a whitespace-free '<METHOD>:<path>' evidence target."
	}
	target := strings.ToUpper(method) + ":" + operationPath
	readable := "Swagger operation '" + strings.ToUpper(method) + " " + operationPath + "'"
	return &evidenceUnit{
		ID:       "swagger:" + source + ":" + target,
		Target:   target,
		Type:     artifactSwagger,
		Symbol:   "operation",
		Path:     displaySwaggerSource(source),
		Readable: readable,
	}, ""
}

func displaySwaggerSource(source string) string {
	parsed, err := url.Parse(source)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return source
	}
	if parsed.User != nil {
		parsed.User = url.User("***")
	}
	if parsed.RawQuery != "" {
		parsed.RawQuery = "<redacted>"
	}
	return parsed.String()
}

type limitedBuffer struct {
	bytes.Buffer
	Limit int
}

func (buffer *limitedBuffer) Write(content []byte) (int, error) {
	if buffer.Len()+len(content) > buffer.Limit {
		remaining := buffer.Limit - buffer.Len()
		if remaining > 0 {
			_, _ = buffer.Buffer.Write(content[:remaining])
		}
		return len(content), errors.New("process output exceeded its limit")
	}
	return buffer.Buffer.Write(content)
}
