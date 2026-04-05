# Ideas

## TimesFM For BadShuffle

TimesFM is not a fit for BadShuffle's transactional core today. It should not be used for:

- real-time inventory conflict decisions
- quote pricing rules
- contract or approval workflow logic
- operational permissions or routing

Those areas need deterministic business rules, which BadShuffle is already moving into explicit Node and Rust engine paths.

Where TimesFM could become valuable later is forecasting.

### Core thesis

BadShuffle is building up exactly the kind of historical signals that a time-series forecasting model can use:

- bookings over time
- item/category demand over time
- signed vs unsigned projects
- lost projects
- seasonality
- event-type cycles
- utilization pressure
- restock pressure
- lead volume
- message / inquiry patterns

That means TimesFM could eventually become a forecasting and planning layer on top of the product, not part of the live transaction engine.

## Best future use cases

### 1. Inventory demand forecasting

Forecast likely demand by:

- item
- category
- venue type
- event type
- city / region
- month / season

Examples:

- expected chair demand over the next 8 weeks
- likely linen color demand by season
- top items likely to hit shortage pressure next month

### 2. Utilization forecasting

Predict future utilization bands:

- overall inventory utilization
- category utilization
- per-item utilization
- high-risk shortage windows

This could power:

- utilization heatmaps
- “future pressure” views in inventory
- proactive oversell warnings before an item actually conflicts

### 3. Restock / buy-more recommendations

Forecasting could support purchasing decisions:

- which items are chronically understocked
- which categories repeatedly spike seasonally
- what should be reordered before peak periods

This is stronger than simple historical averages because a forecasting model can capture trend and seasonality better than static heuristics.

### 4. Revenue forecasting

Forecast:

- expected booked revenue
- likely signed revenue
- seasonal revenue ranges
- confidence bands around forecasted pipeline

This is useful for:

- owner dashboards
- staffing decisions
- cash planning

### 5. Lead and inquiry forecasting

Forecast:

- inbound leads per week
- likely quote creation volume
- likely follow-up load
- likely message volume spikes

This could help staffing and response planning.

### 6. Delivery / workload forecasting

Even without full route optimization, forecasting could estimate:

- likely fulfillment workload by week
- likely outbound / inbound truck pressure
- staffing needs for setup / strike windows

That becomes useful once BadShuffle has stronger fulfillment history.

### 7. Loss / cancellation pattern forecasting

Forecasting could identify periods where:

- project losses rise
- cancellations spike
- approval rates soften

That might reveal pricing, sales, or seasonality issues earlier.

### 8. Forecast-driven assistant insights

The quote assistant or admin assistant could eventually answer:

- “What inventory is most likely to be pressured next month?”
- “What should we buy before wedding season?”
- “Which categories are trending down?”
- “What revenue should we expect this quarter?”

That would be a strong use of AI in the product because it is analytical, not just generative.

## Product surfaces this could power

- Forecast tab in Inventory
- Demand outlook cards on item detail pages
- Category forecasting dashboard
- Revenue forecast widget on dashboard
- Staffing / workload forecast in Team or Fulfillment
- Procurement suggestions page
- “Upcoming pressure” cards in quote builder

## Data prerequisites

Do not integrate a forecasting model until the historical data is clean enough.

Needed foundations:

- quote dates and statuses are reliable
- signed / confirmed / lost transitions are reliable
- quote items and quantities are historically preserved
- set-aside and fulfillment events are logged consistently
- categories are normalized enough to be meaningful
- missing / deleted inventory records do not distort history

Useful extra signals:

- geography / city
- venue type
- event type
- seasonality labels
- staff / salesperson attribution
- message / lead timestamps

## Architecture theory

If adopted later, TimesFM should be used as an offline or batch forecasting subsystem.

Recommended shape:

- nightly or scheduled forecast jobs
- write forecast results back into BadShuffle tables
- surface forecasts in dashboards and planning views
- never let the model directly override transactional decisions

That means:

- Rust stays for deterministic engine logic
- Node remains the app shell
- forecasting becomes a separate analytics service or job

The clean separation would be:

- transactional engine: Rust + deterministic rules
- forecasting layer: TimesFM or another forecasting model
- product UX: BadShuffle surfaces forecasts with confidence and caveats

## Strongest initial rollout

If this is ever pursued, start with one narrow feature:

1. category-level demand forecast
2. item-level shortage risk forecast
3. admin-only dashboard output

Do not start with automated procurement or automatic stock decisions.

## Risks

- not enough clean historical data yet
- inventory history may be too sparse at item level
- model output may look authoritative even when confidence is weak
- forecast quality may vary heavily by category
- extra infrastructure cost and complexity

## Recommendation

Keep this as a future analytics roadmap item.

Best use:

- forecasting
- planning
- utilization analysis
- procurement support
- revenue outlook

Not best use:

- live pricing
- live availability decisions
- assistant text generation
- workflow control
