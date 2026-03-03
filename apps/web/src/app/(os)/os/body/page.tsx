import BodyClient from "./BodyClient";

type SearchParams = {
  date?: string;
};

export default async function BodyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const initialDate = sp?.date ?? null;
  return <BodyClient initialDate={initialDate} />;
}
