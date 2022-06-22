import { Static, Type } from '@sinclair/typebox';
import { FastifyInstance, RouteShorthandOptions } from "fastify";
import { ClassPayment } from '../types';
import mongoGenerator from "../mongoGenerator";
import { ObjectId } from "mongodb";
import { decrypt } from "../utils";

const InvoiceStatusResponse = Type.Object({
    publicKey: Type.String(),
    amount: Type.Number(),
    amountPaid: Type.Number(),
    expiresAt: Type.String(),
    status: Type.String(),
    currency: Type.String()
});

const InvoiceStatusQueryString = Type.Object({
    invoiceId: Type.String()
})

const opts: RouteShorthandOptions = {
    schema: {
        response: {
            200: InvoiceStatusResponse,
            300: Type.String()
        },
        querystring: InvoiceStatusQueryString
    }
}

export default function createInvoiceStatusRoute(server: FastifyInstance) {
    server.get<{ Reply: Static<typeof InvoiceStatusResponse>, Querystring: Static<typeof InvoiceStatusQueryString> }>(
        '/getInvoiceStatus',
        opts,
        async (request, reply) => {
            const invoiceId = request.query.invoiceId;
            const mongoId = decrypt(invoiceId);
            const { db } = await mongoGenerator();
            const selectedPayment = await db.collection('payments').findOne({ _id: new ObjectId(mongoId) }) as ClassPayment & { _id: any };
            if (!selectedPayment) {
                return;
            }

            reply.status(200).send({
                publicKey: selectedPayment.publicKey,
                amount: selectedPayment.amount,
                expiresAt: selectedPayment.expiresAt.toISOString(),
                status: selectedPayment.status,
                amountPaid: selectedPayment.amountPaid,
                currency: selectedPayment.currency
            });
        }
    )
}