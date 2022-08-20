declare global {
    const generateNewId: (options?: { timestamp?: boolean }) => Promise<string>;
}
export {}