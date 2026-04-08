import { useState, useEffect } from 'react'
import { getStats, getDrugCoverages } from '../api'
import client from '../api'

const STATUS_COLORS = {
  met: 'bg-[#EDF7ED] text-[#2E7D32] border-[#4CAF50]',
  partial: 'bg-[#FFF8E1] text-[#E65100] border-[#F59E0B]',
  unmet: 'bg-[#FFEBEE] text-[#C62828] border-[#EF4444]',
  missing: 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]',
}

const LIKELIHOOD_COLORS = {
  high: 'text-[#2E7D32]',
  moderate: 'text-[#E65100]',
  low: 'text-[#C62828]',
}

export default function ApprovalView() {
  const [payers, setPayers] = useState([])
  const [drugs, setDrugs] = useState([])
  const [selectedPayer, setSelectedPayer] = useState('')
  const [selectedDrug, setSelectedDrug] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [stepHistory, setStepHistory] = useState(false)
  const [paDocs, setPaDocs] = useState(false)
  const [specialist, setSpecialist] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getStats().then(data => {
      setPayers(data.payer_list || [])
      if (data.payer_list?.length) setSelectedPayer(data.payer_list[0])
    }).catch(() => {})
    getDrugCoverages({ limit: 200 }).then(data => {
      const unique = [...new Set((data || []).map(r => r.drug_name).filter(Boolean))].sort()
      setDrugs(unique)
      if (unique.length) setSelectedDrug(unique[0])
    }).catch(() => {})
  }, [])

  async function computeScore() {
    if (!selectedDrug || !selectedPayer) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data } = await client.post('/approval-score', {
        drug: selectedDrug,
        payer: selectedPayer,
        diagnosis,
        has_step_therapy_history: stepHistory,
        has_prior_auth_docs: paDocs,
        is_specialist_prescriber: specialist,
      })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compute score')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[var(--color-primary-deep)] mb-1">Approval Scoring</h1>
      <p className="theme-muted mb-6">Score a patient's likelihood of drug approval based on payer criteria</p>

      {/* Input Form */}
      <div className="theme-card rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="theme-muted text-xs block mb-1">Drug</label>
            <select value={selectedDrug} onChange={e => setSelectedDrug(e.target.value)}
              className="theme-input w-full rounded-lg px-3 py-2.5 text-sm">
              {drugs.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="theme-muted text-xs block mb-1">Payer</label>
            <select value={selectedPayer} onChange={e => setSelectedPayer(e.target.value)}
              className="theme-input w-full rounded-lg px-3 py-2.5 text-sm">
              {payers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="theme-muted text-xs block mb-1">Patient Diagnosis</label>
          <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
            placeholder="e.g., Rheumatoid Arthritis, Non-Hodgkin Lymphoma..."
            className="theme-input w-full rounded-lg px-3 py-2.5 text-sm" />
        </div>

        <div className="flex flex-wrap gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
            <input type="checkbox" checked={stepHistory} onChange={e => setStepHistory(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)]" />
            Step therapy completed
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
            <input type="checkbox" checked={paDocs} onChange={e => setPaDocs(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)]" />
            PA documentation prepared
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
            <input type="checkbox" checked={specialist} onChange={e => setSpecialist(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)]" />
            Specialist prescriber
          </label>
        </div>

        <button onClick={computeScore} disabled={loading || !selectedDrug || !selectedPayer}
          className="theme-button-primary px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
          {loading ? 'Computing...' : 'Compute Approval Score'}
        </button>
        {error && <p className="text-[var(--color-error)] text-sm mt-3">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <div>
          {/* Score Circle */}
          <div className="theme-card rounded-xl p-6 mb-4 text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-3"
              style={{ borderColor: result.likelihood === 'high' ? '#4CAF50' : result.likelihood === 'moderate' ? '#F59E0B' : '#EF4444' }}>
              <div>
                <p className={`text-4xl font-bold ${LIKELIHOOD_COLORS[result.likelihood]}`}>{result.score}</p>
                <p className="theme-muted text-xs">/ {result.max_score}</p>
              </div>
            </div>
            <p className={`text-lg font-semibold capitalize ${LIKELIHOOD_COLORS[result.likelihood]}`}>
              {result.likelihood} Likelihood
            </p>
            <p className="theme-muted text-sm mt-1">{result.recommendation}</p>
          </div>

          {/* Breakdown */}
          <div className="theme-card rounded-xl p-6 mb-4">
            <p className="theme-muted text-xs font-semibold uppercase tracking-wide mb-4">Criteria Breakdown</p>
            <div className="space-y-3">
              {result.breakdown.map((b, i) => (
                <div key={i} className={`border rounded-lg p-4 ${STATUS_COLORS[b.status]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{b.criterion}</span>
                    <span className="text-sm font-bold">{b.points} / {b.max}</span>
                  </div>
                  <p className="text-xs opacity-80">{b.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PA Memo */}
          {result.pa_memo && (
            <div className="theme-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="theme-muted text-xs font-semibold uppercase tracking-wide">PA Justification Memo</p>
                <button onClick={() => navigator.clipboard.writeText(result.pa_memo)}
                  className="theme-button-secondary text-xs px-3 py-1 rounded-lg">
                  Copy
                </button>
              </div>
              <div className="text-sm text-[var(--color-text)] whitespace-pre-wrap leading-relaxed bg-[var(--color-surface-soft)] rounded-lg p-4">
                {result.pa_memo}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
