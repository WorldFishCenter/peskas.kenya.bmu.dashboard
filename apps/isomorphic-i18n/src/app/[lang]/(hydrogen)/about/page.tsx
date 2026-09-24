import { Title, Text } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import cn from '@utils/class-names';

const pageHeader = {
  title: 'About Peskas Kenya',
  breadcrumb: [
    {
      href: '/',
      name: 'Home',
    },
    {
      name: 'About',
    },
  ],
};

function SectionBlock({
  title,
  children,
  className,
}: React.PropsWithChildren<{
  title: string;
  className?: string;
}>) {
  return (
    <section className={cn('mb-8 last:mb-0', className)}>
      <Title as="h3" className="mb-4 text-xl font-semibold lg:text-2xl">
        {title}
      </Title>
      {children}
    </section>
  );
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang?: string }>;
}) {
  await params;
  return (
    <>
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <div className="@container">
        <div className="mx-auto max-w-[1200px] space-y-10 py-6">
          <div className="prose mx-auto max-w-full dark:prose-invert lg:prose-lg">
            <Text className="mb-8 text-lg leading-loose text-gray-600 lg:text-xl">
              Peskas is the WCS and WorldFish digital monitoring system designed for small-scale reef fisheries in Kenya. This platform serves as part of a behavioral research experiment testing how different levels of digital information access affect fishing practices and community management in coastal coral reef fisheries.
            </Text>

            <SectionBlock title="Research Purpose">
              <Text className="text-gray-600">
                Peskas is implemented as part of a two-year research study evaluating the effects of digital information on behavior change in small-scale reef fisheries. The study addresses challenges of sustainable fisheries management using the Knowledge-Attitude-Practice (KAP) framework, testing how different levels of information access influence fishing practices and community governance.
              </Text>
            </SectionBlock>

            <SectionBlock title="Experimental Design">
              <Text className="text-gray-600">
                The study implements a Before-After-Control-Impact (BACI) approach across 35 accessible landing sites in Kenya&apos;s 5 coastal counties, organized into Beach Management Units (BMUs). Each BMU represents a different treatment group with varying levels of information access.
              </Text>
              <div className="space-y-6 mt-4">
                <div>
                  <Title as="h4" className="mb-2 text-lg font-medium">
                    Five Treatment Groups
                  </Title>
                  <ul className="list-inside list-disc text-gray-600 space-y-2">
                    <li><strong>Control Group:</strong> Traditional expert-interpreted data presented annually</li>
                    <li><strong>Individual Level:</strong> Dashboard displaying anonymous individual fisher metrics (catch, effort, CPUE, costs, profit)</li>
                    <li><strong>Community Level:</strong> Dashboard showing community-aggregated fisheries data</li>
                    <li><strong>Individual + Community:</strong> Combined access to both individual and community-level information</li>
                    <li><strong>Neighborhood Level:</strong> Access to individual, community, and adjacent BMU comparative data</li>
                  </ul>
                </div>

                <div>
                  <Title as="h4" className="mb-2 text-lg font-medium">
                    Key Performance Metrics
                  </Title>
                  <Text className="text-gray-600">
                    The platform tracks essential fisheries indicators including:
                  </Text>
                  <ul className="mt-2 list-inside list-disc text-gray-600">
                    <li>Catch Per Unit Effort (CPUE) and Income Per Unit Effort (IPUE)</li>
                    <li>Monthly catch volumes, fishing effort, and fuel usage</li>
                    <li>Operational costs and net profit calculations</li>
                    <li>Fishing gear performance and boat utilization</li>
                    <li>Compliance with sustainable fishing thresholds</li>
                  </ul>
                </div>

                <div>
                  <Title as="h4" className="mb-2 text-lg font-medium">
                    Testing Three Behavioral Models
                  </Title>
                  <Text className="text-gray-600">
                    The research tests three theories of human behavior:
                  </Text>
                  <ul className="mt-2 list-inside list-disc text-gray-600">
                    <li><strong>Information Deficit Model:</strong> More information leads to better decisions</li>
                    <li><strong>Self-Interested Actor Model:</strong> Individuals focus on personal costs and benefits</li>
                    <li><strong>Neighborhood Interested Actor Model:</strong> Community-level optimization drives decisions</li>
                  </ul>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock title="Knowledge-Attitude-Practice Framework">
              <Text className="text-gray-600">
                The study employs the KAP framework to structure behavioral interventions, where each treatment group receives different attitude framing and social practice training alongside their information access level.
              </Text>
              <div className="mt-4 space-y-4">
                <div>
                  <Title as="h5" className="mb-2 font-medium">Knowledge Component</Title>
                  <Text className="text-sm text-gray-600">
                    Different scales of information access: expert-interpreted reports, individual fisher data, community-level aggregations, and neighborhood comparisons.
                  </Text>
                </div>
                <div>
                  <Title as="h5" className="mb-2 font-medium">Attitude Component</Title>
                  <Text className="text-sm text-gray-600">
                    Tailored framing for each group - individual cost-benefit focus, community optimization goals, or multi-scale integration approaches.
                  </Text>
                </div>
                <div>
                  <Title as="h5" className="mb-2 font-medium">Practice Component</Title>
                  <Text className="text-sm text-gray-600">
                    Regular observer-organized meetings with group discussions guided by treatment-specific social practice framing and data interpretation training.
                  </Text>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock title="Research Context and Challenges">
              <Text className="text-gray-600">
                This research addresses critical challenges in managing coral reef fisheries commons, particularly the &quot;weakest-neighbor phenomenon&quot; where only the least restrictive management measures are agreed upon across communities. Kenya&apos;s nearshore coral reef fisheries provide ideal conditions for testing knowledge and communication solutions.
              </Text>
              <div className="mt-4 space-y-4">
                <div>
                  <Title as="h5" className="mb-2 font-medium">Commons Management Challenges</Title>
                  <Text className="text-sm text-gray-600">
                    Dense populations, closely adjacent villages, and trans-jurisdictional environments create complex management scenarios requiring innovative information-sharing approaches.
                  </Text>
                </div>
                <div>
                  <Title as="h5" className="mb-2 font-medium">Response Variables</Title>
                  <Text className="text-sm text-gray-600">
                    The study measures approximately 20 response variables including fishing patterns, compliance with regulations, governance participation, livelihood improvement, and community well-being.
                  </Text>
                </div>
                <div>
                  <Title as="h5" className="mb-2 font-medium">Policy Implications</Title>
                  <Text className="text-sm text-gray-600">
                    Findings will inform governments and conservation organizations on the effectiveness of digital tools in promoting sustainable fishing practices while improving coastal community livelihoods.
                  </Text>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock title="Development and Research Partnership">
              <Text className="text-gray-600">
                The Peskas dashboard was developed through a collaborative partnership between WorldFish (Penang, Malaysia) and the Wildlife Conservation Society (Mombasa, Kenya). This digital monitoring system serves as the platform for implementing a controlled behavioral experiment testing the effects of information access on fishing community behavior.
              </Text>
              <div className="mt-4 space-y-4">
                <div>
                  <Title as="h5" className="mb-2 font-medium">Study Timeline</Title>
                  <Text className="text-sm text-gray-600">
                    The two-year intervention study is designed to provide robust evidence on the effectiveness of different information dissemination strategies in small-scale fisheries management.
                  </Text>
                </div>
                <div>
                  <Title as="h5" className="mb-2 font-medium">Research Hypotheses</Title>
                  <Text className="text-sm text-gray-600">
                    The study tests whether increased information access leads to more sustainable behaviors, whether individual or community-focused information is more effective, and how neighborhood-level data influences collective action.
                  </Text>
                </div>
                <div>
                  <Title as="h5" className="mb-2 font-medium">Expected Outcomes</Title>
                  <Text className="text-sm text-gray-600">
                    Results will provide critical evidence for governments and conservation organizations on balancing ecological sustainability with community needs through digital information tools.
                  </Text>
                </div>
              </div>
              <Text className="mt-4 text-gray-600">
                This experiment represents a significant contribution to understanding how digital monitoring systems can effectively support sustainable fisheries management in highly biodiverse nearshore coral reef environments.
              </Text>
            </SectionBlock>
          </div>
        </div>
      </div>
    </>
  );
} 