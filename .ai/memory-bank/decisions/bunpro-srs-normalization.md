# Decision: BunPro SRS normalization

BunPro SRS stages are treated as 0–11 and linearly mapped onto WaniKani’s 0–9 scale:

`normalized = (clamp(stage, 0, 11) / 11) * 9`

Merged map values average WK stage with this normalized BunPro stage when both sources exist.
