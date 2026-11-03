import test from "node:test";
import assert from "node:assert/strict";
import { findTransferEventIndex, selectUniqueDepositCandidate } from "../functions/_lib/tron.js";

test("resolves the exact confirmed Transfer event by token, recipient, sender and raw amount", () => {
  const events=[
    {event_index:3,event_name:"Transfer",contract_address:"TToken",result:{from:"TSender",to:"TWallet",value:"1000000"}},
    {event_index:4,event_name:"Transfer",contract_address:"TOther",result:{from:"TSender",to:"TWallet",value:"1000000"}},
    {event_index:5,event_name:"Transfer",contract_address:"TToken",result:{from:"TOther",to:"TWallet",value:"1000000"}}
  ];
  assert.equal(findTransferEventIndex(events,{contract:"TToken",from:"TSender",to:"TWallet",value:"1000000"}),3);
  assert.equal(findTransferEventIndex(events,{contract:"TToken",from:"TSender",to:"TWallet",value:"1000001"}),null);
});

test("identical Transfer events in one transaction receive distinct event indexes", () => {
  const events=[
    {event_index:7,event_name:"Transfer",contract_address:"TToken",result:{from:"TSender",to:"TWallet",value:"2500000"}},
    {event_index:8,event_name:"Transfer",contract_address:"TToken",result:{from:"TSender",to:"TWallet",value:"2500000"}}
  ];
  const used=new Set();
  const args={contract:"TToken",from:"TSender",to:"TWallet",value:"2500000",used};
  assert.equal(findTransferEventIndex(events,args),7);
  assert.equal(findTransferEventIndex(events,args),8);
  assert.equal(findTransferEventIndex(events,args),null);
});

test("late scanner can select one expired order whose quote matched the transfer block time", () => {
  const order = { id: "order-1", status: "expired", created_at: 1000, expires_at: 8200, expected_micro: 1250000 };
  assert.equal(selectUniqueDepositCandidate([order]), order);
});

test("ambiguous reused quote amounts are never assigned to an arbitrary user", () => {
  const first = { id: "order-1", user_id: "user-1" };
  const second = { id: "order-2", user_id: "user-2" };
  assert.equal(selectUniqueDepositCandidate([first, second]), null);
  assert.equal(selectUniqueDepositCandidate([]), null);
});
