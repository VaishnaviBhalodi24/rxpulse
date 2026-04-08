import { useState, useEffect, useRef, useCallback } from 'react'
import client from '../api'

const TYPE_COLORS = {
  drug: '#5F8FBF',
  payer: '#4CAF50',
  indication: '#F59E0B',
}

const STATUS_EDGE = {
  covered: '#4CAF50',
  restricted: '#F59E0B',
  not_covered: '#9CA3AF',
  treats: '#5F8FBF',
}

export default function GraphView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [hoveredNode, setHoveredNode] = useState(null)
  const canvasRef = useRef(null)
  const nodesRef = useRef([])
  const animRef = useRef(null)

  useEffect(() => {
    client.get('/knowledge-graph').then(res => {
      setData(res.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Simple force-directed layout
  const simulate = useCallback(() => {
    if (!data || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width = canvas.parentElement.offsetWidth
    const height = canvas.height = 500

    let nodes = data.nodes.map((n, i) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 300,
      y: height / 2 + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
      radius: n.type === 'drug' ? 18 : n.type === 'payer' ? 14 : 8,
    }))

    if (filter !== 'all') {
      const visibleIds = new Set()
      nodes.forEach(n => { if (n.type === filter) visibleIds.add(n.id) })
      data.edges.forEach(e => {
        if (visibleIds.has(e.source)) visibleIds.add(e.target)
        if (visibleIds.has(e.target)) visibleIds.add(e.source)
      })
      nodes = nodes.filter(n => visibleIds.has(n.id))
    }

    const nodeMap = {}
    nodes.forEach(n => { nodeMap[n.id] = n })
    const edges = data.edges.filter(e => nodeMap[e.source] && nodeMap[e.target])
    nodesRef.current = nodes

    let iterations = 0
    function tick() {
      if (iterations > 150) return

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          const force = 800 / (dist * dist)
          nodes[i].vx -= (dx / dist) * force
          nodes[i].vy -= (dy / dist) * force
          nodes[j].vx += (dx / dist) * force
          nodes[j].vy += (dy / dist) * force
        }
      }

      // Attraction (edges)
      for (const e of edges) {
        const s = nodeMap[e.source]
        const t = nodeMap[e.target]
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const force = (dist - 100) * 0.01
        s.vx += (dx / dist) * force
        s.vy += (dy / dist) * force
        t.vx -= (dx / dist) * force
        t.vy -= (dy / dist) * force
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (width / 2 - n.x) * 0.001
        n.vy += (height / 2 - n.y) * 0.001
        n.vx *= 0.85
        n.vy *= 0.85
        n.x += n.vx
        n.y += n.vy
        n.x = Math.max(n.radius, Math.min(width - n.radius, n.x))
        n.y = Math.max(n.radius, Math.min(height - n.radius, n.y))
      }

      // Draw
      ctx.clearRect(0, 0, width, height)

      // Edges
      for (const e of edges) {
        const s = nodeMap[e.source]
        const t = nodeMap[e.target]
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.strokeStyle = (STATUS_EDGE[e.label] || '#ddd') + '60'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Nodes
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fillStyle = TYPE_COLORS[n.type] || '#999'
        ctx.fill()
        if (hoveredNode === n.id) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 3
          ctx.stroke()
        }

        // Labels for larger nodes
        if (n.radius >= 14) {
          ctx.fillStyle = '#2F3E4D'
          ctx.font = '10px system-ui'
          ctx.textAlign = 'center'
          ctx.fillText(n.label, n.x, n.y + n.radius + 12)
        }
      }

      iterations++
      animRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [data, filter, hoveredNode])

  useEffect(() => {
    const cleanup = simulate()
    return cleanup
  }, [simulate])

  // Mouse hover detection
  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current || !nodesRef.current.length) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let found = null
    for (const n of nodesRef.current) {
      const dx = mx - n.x
      const dy = my - n.y
      if (dx * dx + dy * dy < n.radius * n.radius) {
        found = n.id
        break
      }
    }
    setHoveredNode(found)
  }, [])

  const stats = data ? {
    drugs: data.nodes.filter(n => n.type === 'drug').length,
    payers: data.nodes.filter(n => n.type === 'payer').length,
    indications: data.nodes.filter(n => n.type === 'indication').length,
    edges: data.edges.length,
  } : null

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary-deep)] mb-1">Knowledge Graph</h1>
          <p className="theme-muted">Interactive drug-payer-indication relationship network</p>
        </div>
        <div className="flex gap-2">
          {['all', 'drug', 'payer', 'indication'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'theme-button-primary' : 'theme-button-secondary'
              }`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 mb-4 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="theme-muted capitalize">{type}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="theme-muted">Loading graph data...</p>
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="theme-card rounded-xl overflow-hidden mb-4">
            <canvas ref={canvasRef} onMouseMove={handleMouseMove}
              className="w-full cursor-crosshair" style={{ height: 500 }} />
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Drugs', count: stats.drugs, color: TYPE_COLORS.drug },
                { label: 'Payers', count: stats.payers, color: TYPE_COLORS.payer },
                { label: 'Indications', count: stats.indications, color: TYPE_COLORS.indication },
                { label: 'Connections', count: stats.edges, color: '#9CA3AF' },
              ].map(s => (
                <div key={s.label} className="theme-card border border-[var(--color-border)] rounded-lg p-3 text-center">
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.count}</p>
                  <p className="theme-muted text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="theme-card rounded-xl p-12 text-center">
          <p className="theme-muted">No data available. Upload policy documents first.</p>
        </div>
      )}
    </div>
  )
}
