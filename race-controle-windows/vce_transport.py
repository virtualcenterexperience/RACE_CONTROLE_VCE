"""Transport selection only. Native archives and coordinates stay unchanged."""
def recent_live_batch(samples, last_index, limit=12, window_s=0.20):
    end=len(samples)
    start=max(0,min(last_index,end))
    if start==end:return [],end
    cutoff=samples[-1]['t']-window_s
    # Work is bounded to the newest native samples, even after a long outage.
    lo,hi=start,end
    while lo<hi:
        mid=(lo+hi)//2
        if samples[mid]['t']<cutoff:lo=mid+1
        else:hi=mid
    start=min(lo,end-1)
    count=end-start
    if count<=limit:return list(samples[start:end]),end
    # Original timestamped points, including the newest position and inputs.
    indices=[start+round(i*(count-1)/(limit-1)) for i in range(limit)]
    return [samples[i] for i in indices],end
