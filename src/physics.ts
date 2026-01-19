import { HavokPlugin } from "@babylonjs/core";

let havokInstance: any = null;
let havokPromise: Promise<any> | null = null;

async function initHavok(): Promise<any> {
  if (havokInstance) return havokInstance;
  if (havokPromise) return havokPromise;

  havokPromise = (async () => {
    const HavokPhysics = (await import("@babylonjs/havok")).default;
    havokInstance = await HavokPhysics({
      locateFile: () => "/assets/HavokPhysics.wasm",
    });
    return havokInstance;
  })();

  return havokPromise;
}

/**
 * Gets the initialized Havok physics plugin.
 * Lazily initializes Havok only when first called.
 */
export async function getHavokPlugin(): Promise<HavokPlugin> {
  const instance = await initHavok();
  return new HavokPlugin(true, instance);
}
