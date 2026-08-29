# IcyCozy cat style reference analysis

Suitability: conditional. The supplied image is a multi-object scene rather than an isolated
character turnaround, so it is not sufficient for an exact 3D reconstruction. It is suitable as
a stylized 2D rendering reference for PetOS.

- Identification: multiple domestic-cat characters (`primaryDomain: character`), shown as
  camera-facing pixel sprites inside an isometric room. Confidence 0.98.
- Silhouette: bilateral quadruped masses; oversized near-spherical head, compact rounded torso,
  short tapered limbs, triangular ears, and a thick curved tail. Chibi proportion is roughly
  2.5-3 head heights.
- Macro hierarchy: torso, head, four legs, tail. Meso hierarchy: ears, muzzle, paws, chest ruff,
  cheek tufts. Micro groups: eyes, nose/mouth pixels, tabby/point/patch markings, fur-edge clusters.
- Spatial relationships: head overlaps the front of the torso; limbs attach below the torso;
  tail sockets into the rear torso and curves upward; paws contact a shared ground plane.
- Surface and finish: opaque matte sprite regions with no continuous PBR response. Lighting is
  represented by 3-5 discrete value bands, not gradients.
- Color: low-saturation coat bases, warm cream highlights, cool charcoal outlines, and small
  high-value eye/muzzle accents.
- Identity features: chunky one-to-two-pixel contour; cluster-shaped fur edges; oversized face;
  broad paws; limited palette; high-contrast face markings; soft low-opacity oval ground shadow.
- Unknowns: rear/hidden anatomy, exact side and back views, animation frames, and breed-specific
  proportions. These remain stylized approximations.

Quality contract for this implementation:

1. Preserve the current PetOS behavior and pose system.
2. Quantize each procedural cat to a small coat-derived palette.
3. Replace anti-aliased silhouette edges with a stable charcoal pixel contour.
4. Retain readable eyes, muzzle, markings, and fur clusters at desktop scale.
5. Keep the art deterministic per pet and render with nearest-neighbor scaling.
