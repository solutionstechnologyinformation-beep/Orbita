export type ProfileUserSnapshot = {
  name?: string | null;
  company?: string | null;
};

export function getProfileFormValues(user?: ProfileUserSnapshot | null) {
  return {
    name: user?.name ?? "",
    company: user?.company ?? "",
  };
}
