# DAY-392 material sheet evidence

These captures document the material-required sheet before and after the
scrollability fix. They are implementation evidence for DAY-392 rather than
generic pull-request assets.

- `DAY-392-before.png`: previous constrained iPhone layout
- `DAY-392-after-top.png`: updated sheet at the top of the content
- `DAY-392-after-bottom.png`: updated sheet after scrolling
- `DAY-392-before-after-scroll.mp4`: 13-second simulator comparison
- `DAY-392.png`: original issue reproduction

The sheet appears deterministically when a saved learning-plan draft has no
uploaded internal school document. The AI does not decide that a particular
document is missing. The learner-provided exam topics only explain which
school material is relevant to upload.
