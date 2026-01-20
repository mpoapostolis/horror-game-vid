import { HavokPlugin } from "@babylonjs/core";

// Havok instance type (WASM module)
type HavokInstance = Awaited<ReturnType<typeof import("@babylonjs/havok").default>>;

let instance: HavokInstance | null = null;
let loading: Promise<HavokInstance> | null = null;

async function initHavok(): Promise<HavokInstance> {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    const HavokPhysics = (await import("@babylonjs/havok")).default;
    instance = await HavokPhysics({
      locateFile: () => "/assets/HavokPhysics.wasm",
    });
    return instance;
  })();

  return loading;
}

export async function getHavokPlugin(): Promise<HavokPlugin> {
  const havok = await initHavok();
  return new HavokPlugin(true, havok);
}
