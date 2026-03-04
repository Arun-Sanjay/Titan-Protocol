import GeneralClient from "./GeneralClient";

type SearchParams = {
  date?: string;
};

export default async function GeneralPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const initialDate = sp?.date ?? null;
  return <GeneralClient initialDate={initialDate} />;
}
