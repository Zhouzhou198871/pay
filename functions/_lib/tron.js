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

/** A transfer is valid only when its confirmed block time falls inside the order's inclusive validity window. */
export const isTransferWithinOrderWindow = (order, transferTimestamp) =>
  Number.isSafeInteger(transferTimestamp) &&
  Number.isSafeInteger(Number(order?.created_at)) &&
  Number.isSafeInteger(Number(order?.expires_at)) &&
  transferTimestamp >= Number(order.created_at) &&
  transferTimestamp <= Number(order.expires_at);
