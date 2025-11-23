'use client'

import { CheckCircle2, ArrowRight } from 'lucide-react'

interface FlowStep {
  id: number
  label: string
  status: string
}

interface IntentFlowDiagramProps {
  confirmed: boolean
  chain?: string
  needsBridge?: boolean
  bridgeTo?: string
}

const getSteps = (chain?: string, needsBridge?: boolean, bridgeTo?: string): FlowStep[] => {
  const steps: FlowStep[] = [
    { id: 1, label: 'NEAR AI Analyzes Intent', status: 'active' },
    { id: 2, label: 'Create Zcash Deposit Address', status: 'pending' },
    { id: 3, label: 'Scan QR & Deposit Zcash', status: 'pending' },
  ]
  
  if (needsBridge && bridgeTo) {
    steps.push({ id: 4, label: `Bridge Zcash to ${bridgeTo.toUpperCase()}`, status: 'pending' })
  }
  
  steps.push(
    { id: 5, label: 'Intent Funding Complete', status: 'pending' },
    { id: 6, label: 'Content Unlock', status: 'pending' }
  )
  
  return steps
}

export function IntentFlowDiagram({ confirmed, chain, needsBridge, bridgeTo }: IntentFlowDiagramProps) {
  const steps = getSteps(chain, needsBridge, bridgeTo)
  const activeStep = confirmed ? steps.length : 1

  return (
    <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 w-full shadow-xl shadow-purple-500/10">
      <h3 className="text-lg font-semibold text-white mb-6 text-center">
        Execution Flow
      </h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = step.id <= activeStep
          const isCompleted = step.id < activeStep
          
          return (
            <div key={step.id} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                ) : isActive ? (
                  <div className="w-6 h-6 rounded-full border-2 border-purple-500 bg-purple-500/20 flex items-center justify-center animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-600" />
                )}
              </div>
              
              <div className="flex-1">
                <p className={`text-sm ${
                  isActive ? 'text-white' : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
              </div>
              
              {index < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0 hidden sm:block" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

