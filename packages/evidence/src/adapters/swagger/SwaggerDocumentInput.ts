import type {
  OpenApi,
  OpenApiV3,
  OpenApiV3_1,
  OpenApiV3_2,
  SwaggerV2,
} from "@typia/interface";

/** Swagger/OpenAPI document versions accepted by the shared converter. */
export type SwaggerDocumentInput =
  | SwaggerV2.IDocument
  | OpenApiV3.IDocument
  | OpenApiV3_1.IDocument
  | OpenApiV3_2.IDocument
  | OpenApi.IDocument;
