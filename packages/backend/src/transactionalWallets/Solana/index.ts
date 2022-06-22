import GenericWallet from '../GenericWallet';
import { Connection, clusterApiUrl, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { AvailableCoins, AvailableTickers } from "@snow/common/src";
import base58 from "bs58";

export default class SolanaTransactional extends GenericWallet {
    private connection: Connection;
    public currency: AvailableTickers = "sol";
    public coinName: AvailableCoins = "Solana";
    static TRANSFER_FEE_LAMPORTS = 5000;

    constructor(...args: ConstructorParameters<typeof GenericWallet>) {
        super(...args);
        this.connection = new Connection(clusterApiUrl(process.env.TESTNETS ? "devnet" : "mainnet-beta"), "confirmed");
    }

    async fromNew(amount: number, callbackUrl?: string) {
        const newKeypair = Keypair.generate();
        return await this._initInDatabase(newKeypair.publicKey.toString(), base58.encode(newKeypair.secretKey), amount, callbackUrl);
    }

    async getBalance() {
        const balance = await this.connection.getBalance(new PublicKey(this.publicKey), "confirmed")

        return {
            result: {
                confirmedBalance: balance / LAMPORTS_PER_SOL,
                unconfirmedBalance: undefined
            }
        };
    }

    protected async _cashOut(balance: number) {
        const [latestBlockhash] = await Promise.all([
            this.connection.getLatestBlockhash('confirmed'),
            this._updateStatus("SENDING")
        ])

        const adminKeypair = Keypair.fromSecretKey(base58.decode(this.privateKey));

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: adminKeypair.publicKey,
                toPubkey: new PublicKey(process.env.ADMIN_SOL_PUBLIC_KEY!),
                lamports: Math.round(balance * LAMPORTS_PER_SOL) - SolanaTransactional.TRANSFER_FEE_LAMPORTS,
            })
        );

        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = adminKeypair.publicKey;

        try {
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [adminKeypair]);
            this.payoutTransactionHash = signature;
            this._updateStatus("FINISHED");
            this.onDie(this.id);
        } catch (error) {
            this._updateStatus("FAILED", JSON.stringify(error));
            this.onDie(this.id);
        }
    }
}