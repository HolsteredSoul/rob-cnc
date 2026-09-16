// ===========================================================================
// Scene resource ownership helpers.  Models own their geometry/materials;
// callers remove roots first, then hand those roots here exactly once.
// ===========================================================================

class SceneResources {
  static disposeRoots(roots, preserve) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    const keep = preserve || new Set();

    (roots || []).forEach((root) => {
      if (!root || (root.userData && root.userData.__resourcesDisposed)) return;
      if (root.userData) root.userData.__resourcesDisposed = true;
      root.traverse((object) => {
        // THREE.Sprite uses a renderer-owned shared quad geometry.  Its
        // material and map are still owned by the effect, but never its geo.
        if (object.geometry && !object.isSprite && !keep.has(object.geometry)) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => {
          if (!material || keep.has(material)) return;
          materials.add(material);
          Object.keys(material).forEach((key) => {
            const value = material[key];
            if (value && value.isTexture && !keep.has(value)) textures.add(value);
          });
        });
      });
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }

  static removeAndDispose(scene, roots, preserve) {
    (roots || []).forEach((root) => {
      if (root && root.parent) root.parent.remove(root);
      else if (root && scene) scene.remove(root);
    });
    this.disposeRoots(roots, preserve);
  }
}
