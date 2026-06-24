import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Target, CheckCircle2, Circle } from 'lucide-react'
import { api } from '../services/api'

export function ChallengesPage(): JSX.Element {
  const { data: challenges = [] } = useQuery({
    queryKey: ['challenges'],
    queryFn: api.getChallenges
  })

  return (
    <div className="h-full overflow-y-auto max-w-3xl">
      <motion.h1
        className="text-4xl font-bold mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Défis quotidiens
      </motion.h1>
      <p className="text-console-muted mb-8">Complétez des défis pour gagner de l'XP</p>

      <div className="space-y-4">
        {challenges.map((challenge, i) => {
          const progress = Math.min((challenge.progress / challenge.target) * 100, 100)

          return (
            <motion.div
              key={challenge.id}
              className="glass rounded-2xl p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {challenge.completed ? (
                    <CheckCircle2 className="text-console-accent" size={24} />
                  ) : (
                    <Circle className="text-console-muted" size={24} />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{challenge.title}</h3>
                    <p className="text-console-muted text-sm">{challenge.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-console-accent font-semibold">
                  <Target size={16} />
                  +{challenge.xpReward} XP
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${challenge.completed ? 'bg-console-accent' : 'bg-console-accent/70'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <span className="text-sm text-console-muted whitespace-nowrap">
                  {challenge.progress}/{challenge.target}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {challenges.length === 0 && (
        <p className="text-console-muted text-center py-12">Aucun défi actif pour aujourd'hui</p>
      )}
    </div>
  )
}
