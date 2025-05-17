import { type DynamoDBDocumentClient, GetCommand, type GetCommandInput, type GetCommandOutput } from "@aws-sdk/lib-dynamodb"
import { BALANCES as TableName } from "./consts.ts"


interface Balance {
  balance?: number
}

export const ERROR = {
  notFound: 'User not found',
  default: 'Request failed'
}

type GetUserBalance = (docClient: DynamoDBDocumentClient) => ({ userId }: { userId: string }) => Promise<number>
export const getUserBalance: GetUserBalance = (docClient) => ({ userId }) =>
  docClient
    .send<GetCommandInput, GetCommandOutput<Balance>>(new GetCommand({ TableName, Key: { id: userId } }))
    .then(({ Item }) => {
      if (!Item) throw ERROR.notFound
      return Item?.balance ?? 100
    }).catch((e) => {
      if (typeof e === 'string') throw Error(e);
      throw Error(ERROR.default)
    });
