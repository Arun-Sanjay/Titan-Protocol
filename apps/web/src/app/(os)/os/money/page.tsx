import MoneyClient from "./MoneyClient";

type SearchParams = {
  date?: string;
};

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const initialDate = sp?.date ?? null;
  return <MoneyClient initialDate={initialDate} />;
}
