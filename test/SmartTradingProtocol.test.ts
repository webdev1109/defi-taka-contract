import { expectRevert, time, constants } from '@openzeppelin/test-helpers';
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer, BigNumber } from "ethers";

import {signTypedMessage} from 'eth-sig-util';
import Wallet from 'ethereumjs-wallet'
import { SmartTradingProtocol, TokenMock, WrappedTokenMock} from '../typechain-types'
import { buildOrderRFQData } from './helpers/orderUtils';

describe("SmartTradingProtocol", async function () {
    let owner:Signer;
    let  wallet: Signer;
    let accounts: Signer[];
    let swap: SmartTradingProtocol;
    let dai: TokenMock;
    let weth: WrappedTokenMock;

    const privatekey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const account = Wallet.fromPrivateKey(Buffer.from(privatekey, 'hex'));
    
    async function buildOrderRFQ (info: any, makerAsset: any, takerAsset: any, makingAmount: any, takingAmount: any, maker:any, allowedSender = constants.ZERO_ADDRESS) {
        return {
            info,
            makerAsset: makerAsset.address,
            takerAsset: takerAsset.address,
            maker: await maker.getAddress(),
            allowedSender,
            makingAmount,
            takingAmount,
        };
    }

    before(async function () {
        accounts = await ethers.getSigners();
        [owner, wallet] = accounts;
    });

    beforeEach(async function () {
        const TokenMock = await ethers.getContractFactory("TokenMock");
        const WrappedTokenMock = await ethers.getContractFactory("WrappedTokenMock");
        const SmartTradingProtocol = await ethers.getContractFactory("SmartTradingProtocol");
        dai = await TokenMock.deploy('DAI', 'DAI');
        weth = await WrappedTokenMock.deploy('WETH', 'WETH');
        swap = await SmartTradingProtocol.deploy();

        await dai.deployed();
        await weth.deployed();
        await swap.deployed();
        this.chainId = await dai.getChainId();

        await dai.mint(await wallet.getAddress(), '1000000');
        await weth.mint(await wallet.getAddress(), '1000000');
        await dai.mint(await owner.getAddress(), '1000000');
        await weth.mint(await owner.getAddress(), '1000000');

        await dai.approve(swap.address, '1000000');
        await weth.approve(swap.address, '1000000');
        await dai.connect(wallet).approve(swap.address, '1000000');
        await weth.connect(wallet).approve(swap.address, '1000000');
    });
    
    describe('OrderRFQ Cancelation', async function () {
        it('should cancel own order', async function () {
            await swap.cancelOrderRFQ('1');
            const invalidator = await swap.invalidatorForOrderRFQ(await owner.getAddress(), '0');
            expect(BigNumber.from(invalidator)).to.be.equal(BigNumber.from('2'));
        });

        it('should cancel own order with huge number', async function () {
            await swap.cancelOrderRFQ('1023');
            const invalidator = await swap.invalidatorForOrderRFQ(await owner.getAddress(), '3');
            expect(BigNumber.from(invalidator)).to.equal(BigNumber.from('1').shl(255));
        });

        it('should not fill cancelled order', async function () {
            const order = buildOrderRFQ('1', dai, weth, 1, 1, wallet);
            const data = buildOrderRFQData(this.chainId, swap.address, await order);
            const signature = signTypedMessage(account.getPrivateKey(), {data});

            await swap.connect(wallet).cancelOrderRFQ('1');

            await expectRevert(
                swap.fillRFQOrder(await order, signature, 1, 0),
                'LOP: invalidated order',
            );
        });
       
    });


})
