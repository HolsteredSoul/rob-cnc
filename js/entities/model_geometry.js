// Small geometry helpers for procedural assets. Returned geometry belongs to
// the model that uses it; no GPU resources are shared between model instances.
class ModelGeometry {
  // Consume temporary geometries and combine static parts into one draw call.
  static merge(parts) {
    const positions = [], normals = [], colors = [];
    const colored = parts.some(part => part.getAttribute('color'));
    parts.forEach(part => {
      const geo = part.index ? part.toNonIndexed() : part;
      const p = geo.getAttribute('position'), n = geo.getAttribute('normal');
      const c = geo.getAttribute('color');
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        if (colored) colors.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1);
      }
      if (geo !== part) geo.dispose();
      part.dispose();
    });
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    if (colored) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return result;
  }

  // Each box: width, height, depth, x, y, z, optional X/Y/Z rotation.
  static boxes(specs) {
    return this.merge(specs.map(s => new THREE.BoxGeometry(s[0], s[1], s[2])
      .rotateX(s[6] || 0).rotateY(s[7] || 0).rotateZ(s[8] || 0)
      .translate(s[3], s[4], s[5])));
  }

  static taperedBox(width, height, depth, inset) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * (1 - inset * 2 / width), p.getY(i), p.getZ(i) * (1 - inset * 2 / depth));
    }
    geo.computeVertexNormals();
    return geo;
  }

  static track(width, height, length) {
    const outline = (w, h, y) => [
      [-w / 2 + h * .28, y], [w / 2 - h * .28, y],
      [w / 2, y + h * .3], [w / 2, y + h * .7],
      [w / 2 - h * .28, y + h], [-w / 2 + h * .28, y + h],
      [-w / 2, y + h * .7], [-w / 2, y + h * .3]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const shape = new THREE.Shape(outline(length, height, 0));
    shape.holes.push(new THREE.Path(outline(length - .2, height - .16, .08).reverse()));
    const geo = new THREE.ExtrudeGeometry(shape, {depth: width, steps: 1, bevelEnabled: false});
    geo.translate(0, 0, -width / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  }
}
