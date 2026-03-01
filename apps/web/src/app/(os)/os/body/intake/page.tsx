import { BodyIntakeWizard } from '../../../../../components/os/BodyIntakeWizard';

type IntakePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OSBodyIntakePage({ searchParams }: IntakePageProps) {
  const params = (await searchParams) ?? {};
  const timeframeRaw = params.timeframe;
  const timeframe = Array.isArray(timeframeRaw) ? timeframeRaw[0] : timeframeRaw;
  return <BodyIntakeWizard initialTimeframe={Number(timeframe ?? 90)} />;
}
