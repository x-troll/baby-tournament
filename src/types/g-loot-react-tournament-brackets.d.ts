// @g-loot/react-tournament-brackets@1.0.31-rc ships a `types` field in its
// package.json pointing at "dist/index.d.ts", a file that doesn't exist —
// the real declarations live under dist/esm/index.d.ts. Working around
// their packaging bug rather than patching node_modules.
declare module "@g-loot/react-tournament-brackets" {
  export * from "@g-loot/react-tournament-brackets/dist/esm/index";
}
