import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * The experiments the band can switch on (roadmap #85).
 *
 * A feature that is still finding its shape is **behind a flag**: it is there,
 * it works, and the member turns it on when they want it — nothing about the
 * rest of the app changes. The flag lives in the device's own storage (it is
 * a display preference, not band data ✓), so it never travels and never
 * needs a rule ✓.
 */

const STORAGE_KEY = "setuno:experiments:v1"

/** The experiments that exist. */
export type ExperimentName = "chordDetection"

/** The experiments that are on, on this device. */
export type Experiments = Partial<Record<ExperimentName, boolean>>

/** Reads the flags. A missing entry means "off". */
export const readExperiments = async (): Promise<Experiments> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const experiments: Experiments = {}
    for (const name of Object.keys(parsed) as ExperimentName[]) {
      if (typeof parsed[name] === "boolean") experiments[name] = parsed[name]
    }
    return experiments
  } catch {
    return {}
  }
}

/** Turns one experiment on or off. */
export const setExperiment = async (name: ExperimentName, enabled: boolean): Promise<void> => {
  const experiments = await readExperiments()
  experiments[name] = enabled
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(experiments))
  } catch {
    // A flag that cannot be stored simply does not change.
  }
}
