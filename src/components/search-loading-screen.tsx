import { useQuery } from 'convex/react'
import { Check, Globe2, LayoutList, LoaderCircle, Search } from 'lucide-react'
import type { Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { cn } from '~/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

type ProgressStage =
  | 'analyzing'
  | 'searching'
  | 'saving'
  | 'completed'
  | 'failed'

type StepState = 'pending' | 'active' | 'completed'

const steps = [
  {
    title: 'Understanding your search',
    description:
      'Extracting the role, location, filters, and intent from your prompt.',
    icon: Search,
  },
  {
    title: 'Scanning approved job hosts',
    description:
      'Searching supported ATS and career-site providers for live openings.',
    icon: Globe2,
  },
  {
    title: 'Saving your results',
    description:
      'Organizing and saving matching roles for the results page.',
    icon: LayoutList,
  },
]

const stageToActiveStep: Record<ProgressStage, number> = {
  analyzing: 0,
  searching: 1,
  saving: 2,
  completed: 3,
  failed: -1,
}

function getStepState(stepIndex: number, stage: ProgressStage): StepState {
  const activeStep = stageToActiveStep[stage]
  if (stepIndex < activeStep) return 'completed'
  if (stepIndex === activeStep) return 'active'
  return 'pending'
}

type SearchLoadingScreenProps = {
  query: string
  progressId: Id<'searchProgress'>
}

export function SearchLoadingScreen({
  query,
  progressId,
}: SearchLoadingScreenProps) {
  const progress = useQuery(api.search.queries.getSearchProgress, {
    progressId,
  })

  const stage = (progress?.stage ?? 'analyzing') as ProgressStage

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-4 py-8 backdrop-blur-sm sm:px-6 lg:px-8">
      <Card className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#1b1b1c] text-white shadow-2xl">
        <CardHeader className="gap-4 pb-2">
          <div className="space-y-3">
            <CardTitle className="text-3xl sm:text-4xl">
              Finding the best matches for you
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6 text-[#a1a1aa] sm:text-base">
              We&apos;re processing your request, searching supported job hosts,
              and preparing structured results.
            </CardDescription>
          </div>

          {query ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 sm:px-5">
              &quot;{query}&quot;
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          {steps.map((step, index) => {
            const state = getStepState(index, stage)
            const Icon = state === 'completed' ? Check : step.icon

            return (
              <div
                className={cn(
                  'rounded-[1.5rem] border p-4 transition-all duration-500',
                  state === 'active' && 'border-white/20 bg-white/10',
                  state === 'completed' &&
                    'border-emerald-500/20 bg-emerald-500/5',
                  state === 'pending' &&
                    'border-white/5 bg-white/[0.02] opacity-50',
                )}
                key={step.title}
              >
                <div
                  className={cn(
                    'mb-3 inline-flex size-10 items-center justify-center rounded-full transition-colors duration-500',
                    state === 'active' && 'bg-white/15',
                    state === 'completed' && 'bg-emerald-500/15',
                    state === 'pending' && 'bg-white/5',
                  )}
                >
                  {state === 'active' ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <Icon
                      className={cn(
                        'size-5',
                        state === 'completed' && 'text-emerald-400',
                      )}
                    />
                  )}
                </div>
                <h2 className="text-base font-medium">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
                  {step.description}
                </p>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
