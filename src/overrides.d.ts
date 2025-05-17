import type { GetItemCommandOutput } from "@aws-sdk/client-dynamodb";
import type { NativeAttributeValue } from "@aws-sdk/lib-dynamodb"


declare module '@aws-sdk/lib-dynamodb' {
  export interface GetCommandOutput<T = Record<string, NativeAttributeValue>> extends GetItemCommandOutput {
    Item?: T;
  }
}
