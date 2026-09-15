import type {
  OpenApi,
  OpenApiV3,
  OpenApiV3_1,
  OpenApiV3_2,
  SwaggerV2,
} from "@typia/interface";

/**
 * Swagger and OpenAPI document versions accepted by the shared converter.
 *
 * The Swagger adapter narrows supported parser output to this union before it
 * extracts operations, keeping version-specific source models behind one
 * input.
 */
export type EvidSwaggerDocumentInput =
  | SwaggerV2.IDocument
  | OpenApiV3.IDocument
  | OpenApiV3_1.IDocument
  | OpenApiV3_2.IDocument
  | OpenApi.IDocument;
