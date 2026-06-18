// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/AgentEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract AgentEscrowTest is Test {
    AgentEscrow internal esc;
    MockERC20 internal usdc;

    address internal agent = address(0xA9E47);
    address internal buyer = address(0xB);
    address internal seller = address(0x5E11E2);
    address internal stranger = address(0xBAD);

    uint256 internal constant AMT = 1_000e6;
    uint64 internal deadline;

    function setUp() public {
        usdc = new MockERC20("USD Coin (mock)", "USDC", 6);
        esc = new AgentEscrow(agent, IERC20(address(usdc)));
        deadline = uint64(block.timestamp + 7 days);
        usdc.mint(buyer, 10_000e6);
        vm.prank(buyer);
        usdc.approve(address(esc), type(uint256).max);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(buyer);
        id = esc.createDeal(seller, AMT, deadline, "Build a landing page matching the brief.");
    }

    function test_CreatePullsFunds() public {
        uint256 id = _create();
        assertEq(usdc.balanceOf(address(esc)), AMT);
        AgentEscrow.Deal memory d = esc.getDeal(id);
        assertEq(d.buyer, buyer);
        assertEq(d.seller, seller);
        assertEq(uint8(d.status), uint8(AgentEscrow.Status.FUNDED));
    }

    function test_HappyPath_BuyerReleases() public {
        uint256 id = _create();
        vm.prank(seller);
        esc.submitDelivery(id, "Deployed at https://example.com, matches the brief.");
        vm.prank(buyer);
        esc.approveRelease(id);
        assertEq(usdc.balanceOf(seller), AMT);
        assertEq(uint8(esc.getDeal(id).status), uint8(AgentEscrow.Status.RELEASED));
    }

    function test_SellerCanRefund() public {
        uint256 id = _create();
        vm.prank(seller);
        esc.refundBuyer(id);
        assertEq(usdc.balanceOf(buyer), 10_000e6);
        assertEq(uint8(esc.getDeal(id).status), uint8(AgentEscrow.Status.REFUNDED));
    }

    function test_AgentResolvesRelease() public {
        uint256 id = _create();
        vm.prank(seller);
        esc.submitDelivery(id, "delivered");
        vm.prank(buyer);
        esc.dispute(id);

        vm.prank(agent);
        esc.resolve(id, AgentEscrow.Outcome.RELEASE, 88, keccak256("met the spec"));
        assertEq(usdc.balanceOf(seller), AMT);
        assertEq(uint8(esc.getDeal(id).status), uint8(AgentEscrow.Status.RELEASED));
        assertEq(esc.getDeal(id).confidencePct, 88);
    }

    function test_AgentResolvesRefund() public {
        uint256 id = _create();
        vm.prank(seller);
        esc.submitDelivery(id, "blank");
        vm.prank(seller);
        esc.dispute(id);
        vm.prank(agent);
        esc.resolve(id, AgentEscrow.Outcome.REFUND, 90, keccak256("not delivered"));
        assertEq(usdc.balanceOf(buyer), 10_000e6);
        assertEq(uint8(esc.getDeal(id).status), uint8(AgentEscrow.Status.REFUNDED));
    }

    function test_AgentUnresolvableRefundsBuyer() public {
        uint256 id = _create();
        vm.prank(buyer);
        esc.dispute(id);
        vm.prank(agent);
        esc.resolve(id, AgentEscrow.Outcome.UNRESOLVABLE, 40, keccak256("too thin"));
        assertEq(usdc.balanceOf(buyer), 10_000e6);
        assertEq(uint8(esc.getDeal(id).status), uint8(AgentEscrow.Status.UNRESOLVABLE));
    }

    function test_OnlyAgentResolves() public {
        uint256 id = _create();
        vm.prank(buyer);
        esc.dispute(id);
        vm.prank(stranger);
        vm.expectRevert(AgentEscrow.NotAgent.selector);
        esc.resolve(id, AgentEscrow.Outcome.RELEASE, 90, bytes32(0));
    }

    function test_ResolveRequiresDispute() public {
        uint256 id = _create();
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentEscrow.BadState.selector, AgentEscrow.Status.FUNDED));
        esc.resolve(id, AgentEscrow.Outcome.RELEASE, 90, bytes32(0));
    }

    function test_ClaimDeliveredAfterDeadline() public {
        uint256 id = _create();
        vm.prank(seller);
        esc.submitDelivery(id, "delivered");
        vm.prank(seller);
        vm.expectRevert(AgentEscrow.TooEarly.selector);
        esc.claimDelivered(id);
        vm.warp(deadline + 1);
        vm.prank(seller);
        esc.claimDelivered(id);
        assertEq(usdc.balanceOf(seller), AMT);
    }

    function test_ReclaimUndeliveredAfterDeadline() public {
        uint256 id = _create();
        vm.warp(deadline + 1);
        vm.prank(buyer);
        esc.reclaimUndelivered(id);
        assertEq(usdc.balanceOf(buyer), 10_000e6);
    }

    function test_StrangerCannotRelease() public {
        uint256 id = _create();
        vm.prank(stranger);
        vm.expectRevert(AgentEscrow.NotBuyer.selector);
        esc.approveRelease(id);
    }

    function test_CannotDoubleSettle() public {
        uint256 id = _create();
        vm.prank(buyer);
        esc.approveRelease(id);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(AgentEscrow.BadState.selector, AgentEscrow.Status.RELEASED));
        esc.approveRelease(id);
    }
}
