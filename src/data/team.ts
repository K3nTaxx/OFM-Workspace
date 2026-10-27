// Comptes de l'équipe. Seule l'empreinte SHA-256 du mot de passe est stockée ici
// (utilisée uniquement en mode démo, avant que Supabase soit branché).
export const TEAM = [
  { id: "quentin", name: "Quentin", email: "quentin.ofm@example.com", passwordSha256: "ee64d4363fcbe6d3bc27b519f3ac7faa4c7cfae6e59723f5492f407704f4a684" },
  { id: "logan", name: "Logan", email: "logan.ofm@example.com", passwordSha256: "7183d9fb4c6f5e6ec8e6d124b27848dea304b9e852aadd317be0bfb08e5b7d6f" },
] as const

export type TeamMemberId = (typeof TEAM)[number]["id"]
