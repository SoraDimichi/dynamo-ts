import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb"
import { BALANCES, TRANSACTIONS } from "./consts.ts"

export const ERROR = {
  debit: "User's Balance is insufficient",
  idempotency: "Transaction already processed",
  default: "Transaction failed",
  amountNaN: 'Amount is not a number',
  amountInvalid: "Amount cannot be equal or less than zero"
};

type TransactProps = { idempotentKey: string, userId: string, amount: string, type: 'debit' | 'credit' };
export const transact = (docClient: DynamoDBDocumentClient) => async (props: TransactProps) => {
  const { idempotentKey, userId, amount: amt, type } = props;
  const amount = Number(amt)

  if (isNaN(amount)) throw Error('Amount is not a number');
  if (!(amount > 0)) throw Error("Amount cannot be equal or less than zero");

  const createdAt = new Date().toISOString()


  const Put = {
    TableName: TRANSACTIONS,
    Item: { idempotentKey, userId, amount, type, createdAt },
    ConditionExpression: "attribute_not_exists(idempotentKey)"
  }

  const debit = type === 'debit'
  const Update = {
    TableName: BALANCES,
    Key: { id: userId },
    ...(debit ? {
      UpdateExpression: "SET balance = balance - :amount",
      ConditionExpression: "attribute_exists(balance) AND balance >= :amount",
      ExpressionAttributeValues: { ":amount": amount }
    } : {
      UpdateExpression: "SET balance = if_not_exists(balance, :zero) + :amount",
      ExpressionAttributeValues: { ":amount": amount, ":zero": 0 }
    })
  }

  return docClient.send(new TransactWriteCommand({ TransactItems: [{ Put }, { Update }] }))
    .then(() => true).catch((err) => {
      const [put, update] = err.CancellationReasons ?? [];

      if (update?.Code === 'ConditionalCheckFailed') throw Error(ERROR.debit)
      if (put?.Code === 'ConditionalCheckFailed') throw Error(ERROR.idempotency);
      throw Error(ERROR.default);
    })
};
