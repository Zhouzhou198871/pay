export const DEFAULT_USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export const findTransferEventIndex = (events,{contract,from,to,value,used=new Set()}) => {
  const same=(a,b)=>String(a??"").toLowerCase()===String(b??"").toLowerCase();
  for(const event of Array.isArray(events)?events:[]) {
    const index=Number(event?.event_index);
    const result=event?.result||{};
    if(!Number.isSafeInteger(index)||index<0||used.has(index)) continue;
    if(event?.event_name!=="Transfer"||!same(event?.contract_address,contract)) continue;
    if(!same(result.from,from)||!same(result.to,to)||String(result.value??"")!==String(value)) continue;
    used.add(index);
    return index;
  }
  return null;
};

// Only auto-match a chain transfer when exactly one order fits its amount and block time.
export const selectUniqueDepositCandidate = (orders) =>
  Array.isArray(orders) && orders.length === 1 ? orders[0] : null;

/** TRON block timestamps are milliseconds; order timestamps are seconds. Compare without truncating sub-second lateness. */
export const isTransferWithinOrderWindow = (order, transferTimestampMs) =>
  Number.isSafeInteger(transferTimestampMs) &&
  Number.isSafeInteger(Number(order?.created_at)) &&
  Number.isSafeInteger(Number(order?.expires_at)) &&
  transferTimestampMs >= Number(order.created_at) * 1000 &&
  transferTimestampMs <= Number(order.expires_at) * 1000;
