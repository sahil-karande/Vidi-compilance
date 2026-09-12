import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  MessageSquare, 
  ExternalLink, 
  X, 
  Filter, 
  Sparkles, 
  Layers, 
  Share2, 
  Play, 
  Pause, 
  ArrowRight, 
  TrendingUp, 
  FileText,
  List,
  Network,
  Maximize2,
  SlidersHorizontal,
  ChevronRight,
  Hash
} from 'lucide-react';
import { graphAPI } from '../lib/api';

// ─────────────────────────────────────────────────────────────
//  Regulatory Authority Color Palette & Themes
// ─────────────────────────────────────────────────────────────
const CORPUS_COLORS = {
  rbi: {
    base: '#38bdf8', // Sky Cyan
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    glow: 'rgba(56, 189, 248, 0.4)',
    label: 'Reserve Bank of India (RBI)'
  },
  sebi: {
    base: '#a855f7', // Purple
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'rgba(168, 85, 247, 0.4)',
    label: 'Securities & Exchange Board (SEBI)'
  },
  mca: {
    base: '#f59e0b', // Amber
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'rgba(245, 158, 11, 0.4)',
    label: 'Ministry of Corporate Affairs (MCA)'
  },
  gst: {
    base: '#10b981', // Emerald
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'rgba(168, 85, 247, 0.4)',
    glowEmerald: 'rgba(16, 185, 129, 0.4)',
    label: 'Goods & Services Tax (GST)'
  },
  fema: {
    base: '#ec4899', // Pink / Rose
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    glow: 'rgba(236, 72, 153, 0.4)',
    label: 'Foreign Exchange Management (FEMA)'
  },
  unknown: {
    base: '#64748b', // Slate
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    glow: 'rgba(100, 116, 139, 0.3)',
    label: 'Statutory Act / Other'
  }
};

const getCorpusKey = (corpus) => {
  if (!corpus) return 'unknown';
  const c = corpus.toLowerCase().trim();
  if (c.includes('rbi')) return 'rbi';
  if (c.includes('sebi')) return 'sebi';
  if (c.includes('mca')) return 'mca';
  if (c.includes('gst')) return 'gst';
  if (c.includes('fema')) return 'fema';
  return 'unknown';
};

export default function Explorer() {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomBehaviorRef = useRef(null);

  // Responsive Device State (< 768px)
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'graph'));

  // Data States
  const [graphData, setGraphData] = useState({ nodes: [], links: [], meta: {} });
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search Controls
  const [selectedCorpus, setSelectedCorpus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [nodeLimit, setNodeLimit] = useState(250);
  const [minCitations, setMinCitations] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [isPhysicsRunning, setIsPhysicsRunning] = useState(true);

  // Selection & Details
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, visible: false });

  // Handle Window Resize for Mobile Viewport detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch macro statistics once
  useEffect(() => {
    async function loadStats() {
      try {
        const s = await graphAPI.getStats();
        if (s) setStats(s);
      } catch (e) {
        console.warn('Stats fetch ignored:', e);
      }
    }
    loadStats();
  }, []);

  // Fetch graph data whenever primary filters change
  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        limit: nodeLimit,
        min_citations: minCitations
      };
      if (selectedCorpus !== 'all') {
        params.corpus = selectedCorpus;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await graphAPI.getGraph(params);
      setGraphData({
        nodes: res.nodes || [],
        links: res.links || res.edges || [],
        meta: res.meta || {}
      });
    } catch (err) {
      console.error('Failed to load citation graph:', err);
      setError('Unable to load regulatory citation graph. Please check backend connection.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCorpus, searchTerm, nodeLimit, minCitations]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Fetch node deep details when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setNodeDetails(null);
      return;
    }

    let isMounted = true;
    async function loadNodeDetails() {
      setIsLoadingDetails(true);
      try {
        const details = await graphAPI.getNodeDetails(selectedNode.id);
        if (isMounted) setNodeDetails(details);
      } catch (err) {
        console.warn('Deep node detail fetch fallback:', err);
        if (isMounted) {
          // Fallback based on client links
          const incoming = graphData.links.filter(
            l => (typeof l.target === 'object' ? l.target.id : l.target) === selectedNode.id
          ).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            weight: l.weight || 1,
            corpus: l.corpus_src || 'unknown'
          }));
          const outgoing = graphData.links.filter(
            l => (typeof l.source === 'object' ? l.source.id : l.source) === selectedNode.id
          ).map(l => ({
            target: typeof l.target === 'object' ? l.target.id : l.target,
            weight: l.weight || 1,
            corpus: l.corpus_tgt || 'unknown'
          }));
          setNodeDetails({
            node: selectedNode,
            incoming_citations: incoming,
            outgoing_citations: outgoing,
            total_incoming: incoming.length,
            total_outgoing: outgoing.length
          });
        }
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    }

    loadNodeDetails();
    return () => { isMounted = false; };
  }, [selectedNode, graphData.links]);

  // Helper to compute node radius
  const getNodeRadius = useCallback((node) => {
    const citations = node.citation_count || 0;
    if (citations <= 0) return 7;
    return Math.min(28, 7 + Math.log2(citations + 1) * 3);
  }, []);

  // Set of connected node IDs for the currently hovered or selected node
  const activeConnectedNodeIds = useMemo(() => {
    const target = selectedNode || hoveredNode;
    if (!target) return null;
    const connected = new Set([target.id]);
    graphData.links.forEach(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      if (srcId === target.id) connected.add(tgtId);
      if (tgtId === target.id) connected.add(srcId);
    });
    return connected;
  }, [selectedNode, hoveredNode, graphData.links]);

  // Client-side search / filter for mobile list view
  const filteredNodesList = useMemo(() => {
    let list = graphData.nodes || [];
    if (selectedCorpus !== 'all') {
      list = list.filter(n => getCorpusKey(n.corpus) === selectedCorpus);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(n => 
        (n.id && n.id.toLowerCase().includes(term)) ||
        (n.label && n.label.toLowerCase().includes(term)) ||
        (n.title && n.title.toLowerCase().includes(term)) ||
        (n.circular_no && n.circular_no.toLowerCase().includes(term))
      );
    }
    // Sort by citation count descending
    return [...list].sort((a, b) => (b.citation_count || 0) - (a.citation_count || 0));
  }, [graphData.nodes, selectedCorpus, searchTerm]);

  // ── D3 Force-Directed Simulation Renderer ──
  useEffect(() => {
    if (viewMode !== 'graph') return;
    if (!svgRef.current || !containerRef.current) return;
    if (!graphData.nodes.length) {
      d3.select(svgRef.current).selectAll('*').remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    svg.selectAll('*').remove();
    svg.attr('viewBox', [0, 0, width, height]);

    // Defs for markers & filters
    const defs = svg.append('defs');

    // Arrow markers for links
    defs.append('marker')
      .attr('id', 'citation-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#64748b')
      .attr('opacity', 0.6);

    defs.append('marker')
      .attr('id', 'citation-arrow-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#38bdf8')
      .attr('opacity', 0.9);

    // Glow filter for highlighted nodes
    const glowFilter = defs.append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Main zoomable world container
    const g = svg.append('g').attr('class', 'graph-world');

    // Zoom setup
    const zoom = d3.zoom()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Clone data for simulation to avoid mutating state
    const nodes = graphData.nodes.map(d => ({ ...d }));
    const links = graphData.links.map(d => ({ ...d }));

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => Math.max(50, 110 - Math.min(60, (d.weight || 1) * 3))))
      .force('charge', d3.forceManyBody().strength(-160).distanceMax(500))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force('collide', d3.forceCollide().radius(d => getNodeRadius(d) + 12).iterations(2));

    simulationRef.current = simulation;

    // Links render
    const linkGroup = g.append('g').attr('class', 'links-layer');
    const link = linkGroup.selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', d => Math.min(4, Math.max(1, Math.log2((d.weight || 1) + 1))))
      .attr('marker-end', 'url(#citation-arrow)');

    // Nodes render
    const nodeGroup = g.append('g').attr('class', 'nodes-layer');
    const node = nodeGroup.selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Node Drag behavior
    const drag = d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
    node.call(drag);

    // Outer glow circle for central/selected nodes
    node.append('circle')
      .attr('class', 'node-pulse')
      .attr('r', d => getNodeRadius(d) + 5)
      .attr('fill', d => {
        const cKey = getCorpusKey(d.corpus);
        return CORPUS_COLORS[cKey]?.base || '#64748b';
      })
      .attr('opacity', 0)
      .attr('filter', 'url(#node-glow)');

    // Main node circle
    node.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => {
        const cKey = getCorpusKey(d.corpus);
        return CORPUS_COLORS[cKey]?.base || '#64748b';
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2);

    // Inner highlight ring
    node.append('circle')
      .attr('r', d => Math.max(2, getNodeRadius(d) * 0.4))
      .attr('fill', '#ffffff')
      .attr('opacity', 0.25);

    // Labels
    const label = node.append('text')
      .attr('class', 'node-label')
      .attr('dy', d => getNodeRadius(d) + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-size', d => (d.citation_count > 20 ? '11px' : '9px'))
      .attr('font-weight', d => (d.citation_count > 20 ? '700' : '500'))
      .attr('pointer-events', 'none')
      .text(d => {
        const str = d.label || d.id;
        return str.length > 22 ? str.substring(0, 20) + '…' : str;
      })
      .style('opacity', d => {
        if (!showLabels) return 0;
        return (d.citation_count >= 5 || nodes.length < 50) ? 0.9 : 0.4;
      });

    // Node Click Handler
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNode(d);
      
      // Center view on clicked node smoothly
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(1.4)
        .translate(-d.x, -d.y);
      svg.transition().duration(600).call(zoom.transform, transform);
    });

    // Dynamic Contextual Hover Handlers (Coordinates-based Tooltip)
    node.on('mouseenter', (event, d) => {
      setHoveredNode(d);
      const rect = container.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;
      setTooltipPos({ x: clientX, y: clientY, visible: true });
    });

    node.on('mousemove', (event) => {
      const rect = container.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;
      setTooltipPos({ x: clientX, y: clientY, visible: true });
    });

    node.on('mouseleave', () => {
      setHoveredNode(null);
      setTooltipPos(prev => ({ ...prev, visible: false }));
    });

    // Background Click to deselect
    svg.on('click', () => {
      setSelectedNode(null);
    });

    // Tick update
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, getNodeRadius, showLabels, viewMode]);

  // Update visual styles on hover or selected node change
  useEffect(() => {
    if (viewMode !== 'graph' || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const activeTarget = selectedNode || hoveredNode;

    if (!activeTarget) {
      svg.selectAll('.node-circle')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 2)
        .attr('opacity', 1);
      svg.selectAll('.node-pulse')
        .attr('opacity', 0);
      svg.selectAll('.node-label')
        .style('opacity', d => {
          if (!showLabels) return 0;
          return (d.citation_count >= 5) ? 0.9 : 0.4;
        });
      svg.selectAll('.links-layer line')
        .attr('stroke', '#334155')
        .attr('stroke-opacity', 0.35)
        .attr('stroke-width', d => Math.min(4, Math.max(1, Math.log2((d.weight || 1) + 1))))
        .attr('marker-end', 'url(#citation-arrow)');
      return;
    }

    const connectedSet = activeConnectedNodeIds || new Set([activeTarget.id]);

    // Highlight nodes
    svg.selectAll('.node').each(function(d) {
      const el = d3.select(this);
      const isTarget = d.id === activeTarget.id;
      const isConnected = connectedSet.has(d.id);

      el.select('.node-circle')
        .attr('stroke', isTarget ? '#ffffff' : (isConnected ? '#38bdf8' : '#0f172a'))
        .attr('stroke-width', isTarget ? 3.5 : (isConnected ? 2.5 : 1.5))
        .attr('opacity', isConnected ? 1 : 0.2);

      el.select('.node-pulse')
        .attr('opacity', isTarget ? 0.75 : (isConnected ? 0.3 : 0));

      el.select('.node-label')
        .style('opacity', isConnected ? 1 : 0.1)
        .attr('font-weight', isConnected ? '700' : '400');
    });

    // Highlight links
    svg.selectAll('.links-layer line').each(function(d) {
      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
      const isConnected = (srcId === activeTarget.id || tgtId === activeTarget.id);

      d3.select(this)
        .attr('stroke', isConnected ? '#38bdf8' : '#334155')
        .attr('stroke-opacity', isConnected ? 0.9 : 0.08)
        .attr('stroke-width', isConnected ? 2.5 : 1)
        .attr('marker-end', isConnected ? 'url(#citation-arrow-active)' : 'url(#citation-arrow)');
    });
  }, [selectedNode, hoveredNode, activeConnectedNodeIds, showLabels, viewMode]);

  // Zoom control buttons
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || !containerRef.current) return;
    d3.select(svgRef.current).transition().duration(500).call(
      zoomBehaviorRef.current.transform,
      d3.zoomIdentity.translate(0, 0).scale(1)
    );
  };

  const handleTogglePhysics = () => {
    if (!simulationRef.current) return;
    if (isPhysicsRunning) {
      simulationRef.current.stop();
      setIsPhysicsRunning(false);
    } else {
      simulationRef.current.alpha(0.3).restart();
      setIsPhysicsRunning(true);
    }
  };

  // Quick Action: "Ask about this" opens chat prefilled
  const handleAskAboutCircular = (node) => {
    if (!node) return;
    const prompt = `Explain the key regulatory provisions, compliance requirements, and historical citation network of ${node.id} (${node.label || node.title || 'regulatory circular'}). What other circulars or statutory acts govern this?`;
    navigate('/chat', {
      state: { initialQuery: prompt }
    });
  };

  const activeCorpusColor = selectedNode ? CORPUS_COLORS[getCorpusKey(selectedNode.corpus)] : null;

  return (
    <div className="relative w-full h-[calc(100vh-65px)] bg-[#030712] text-slate-200 flex flex-col overflow-hidden font-sans">
      
      {/* ── Top Header Bar ── */}
      <div className="w-full bg-[#090d16] border-b border-slate-800/80 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white tracking-tight">Regulation Citation Network</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300">
                v0.5 Explorer
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-slate-400">
              Interactive dependency graph mapping statutory cross-references across RBI, SEBI, MCA, and GST.
            </p>
          </div>
        </div>

        {/* View Mode Switcher (Graph vs Mobile List Fallback) */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-xl flex items-center">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'graph'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Interactive D3 Force Graph"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Graph</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mobile Responsive List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List View</span>
            </button>
          </div>

          {/* Macro Metrics Scorecards */}
          {stats && (
            <div className="hidden xl:flex items-center gap-2 text-xs">
              <div className="bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Nodes:</span>
                <span className="font-semibold text-white font-mono">{stats.total_nodes}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Citations:</span>
                <span className="font-semibold text-white font-mono">{stats.total_edges}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar: Search by Circular Number & Jurisdiction ── */}
      <div className="w-full bg-slate-950/60 border-b border-slate-800/60 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-10 backdrop-blur-md">
        
        {/* Corpus Pill Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full no-scrollbar">
          <span className="text-slate-500 font-medium mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Corpora' },
            { id: 'rbi', label: 'RBI' },
            { id: 'sebi', label: 'SEBI' },
            { id: 'mca', label: 'MCA' },
            { id: 'gst', label: 'GST' },
            { id: 'fema', label: 'FEMA' },
          ].map((c) => {
            const isActive = selectedCorpus === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCorpus(c.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-white border border-cyan-400/50 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                    : 'bg-slate-900/50 text-slate-400 border border-slate-800/80 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Circular Number / Statute Search Input */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search circular no. (e.g. DOR.CRE, SEBI)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/80 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-full transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Node Density limit (Desktop only) */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-xl">
            <SlidersHorizontal className="w-3 h-3 text-slate-500" />
            <span>Nodes:</span>
            <select
              value={nodeLimit}
              onChange={(e) => setNodeLimit(Number(e.target.value))}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={100} className="bg-slate-900">100</option>
              <option value={250} className="bg-slate-900">250</option>
              <option value={400} className="bg-slate-900">400</option>
              <option value={700} className="bg-slate-900">700</option>
            </select>
          </div>

          {/* Label Toggle (Graph mode only) */}
          {viewMode === 'graph' && (
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`hidden sm:inline-flex px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                showLabels
                  ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Labels {showLabels ? 'On' : 'Off'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main Viewport Area ── */}
      <div className="relative flex-1 w-full h-full overflow-hidden" ref={containerRef}>
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-xs text-slate-300 font-mono tracking-wider animate-pulse">
              Synthesizing Topological Citation Network...
            </p>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950/80 border border-red-500/40 text-red-300 text-xs px-4 py-2 rounded-xl backdrop-blur-md z-30 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ─────────────────────────────────────────────────── */}
        {/* MODE 1: D3 Interactive Force Graph                 */}
        {/* ─────────────────────────────────────────────────── */}
        {viewMode === 'graph' && (
          <>
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none" />

            {/* Floating Zoom & Pan Controls */}
            <div className="absolute bottom-6 left-4 md:left-6 flex flex-col gap-2 z-20">
              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-2xl p-1.5 flex flex-col gap-1 shadow-2xl">
                <button
                  onClick={handleZoomIn}
                  title="Zoom In (+)"
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out (-)"
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  title="Reset & Fit to Screen"
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <div className="w-full h-[1px] bg-slate-800 my-0.5" />
                <button
                  onClick={handleTogglePhysics}
                  title={isPhysicsRunning ? "Pause Physics Simulation" : "Resume Physics Simulation"}
                  className={`p-2 rounded-xl transition-colors ${
                    isPhysicsRunning ? 'text-cyan-400 hover:bg-slate-800' : 'text-amber-400 hover:bg-slate-800'
                  }`}
                >
                  {isPhysicsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Jurisdiction Legend */}
            <div className="absolute bottom-6 right-6 hidden lg:flex flex-col gap-2 z-20">
              <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-2xl p-3 shadow-2xl text-xs space-y-2 max-w-xs">
                <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px] pb-1 border-b border-slate-800">
                  <span>Jurisdiction Legend</span>
                  <span className="text-[10px] text-slate-500 font-mono">Radius ∝ Citations</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  {Object.entries(CORPUS_COLORS).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.base }} />
                      <span className="text-slate-400 uppercase font-mono text-[10px]">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contextual Floating Tooltip on Hover (Follows Cursor) */}
            {hoveredNode && !selectedNode && tooltipPos.visible && (
              <div 
                className="absolute z-30 pointer-events-none bg-slate-950/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] max-w-xs space-y-1.5 transform -translate-x-1/2 -translate-y-full mb-3"
                style={{
                  left: Math.max(160, Math.min(tooltipPos.x, (containerRef.current?.clientWidth || 800) - 160)),
                  top: Math.max(120, tooltipPos.y - 12),
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="w-2 h-2 rounded-full animate-ping"
                    style={{ backgroundColor: CORPUS_COLORS[getCorpusKey(hoveredNode.corpus)]?.base || '#64748b' }}
                  />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                    {hoveredNode.corpus || 'Statutory'}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {hoveredNode.citation_count || 0} citations
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white line-clamp-2">{hoveredNode.label || hoveredNode.id}</h4>
                {hoveredNode.title && (
                  <p className="text-[11px] text-slate-400 line-clamp-2">{hoveredNode.title}</p>
                )}
                <div className="text-[9px] text-cyan-300/80 font-mono pt-1 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Click node to inspect details</span>
                  <span>→</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─────────────────────────────────────────────────── */}
        {/* MODE 2: Mobile Fallback List View (< 768px)         */}
        {/* ─────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="w-full h-full overflow-y-auto p-4 md:p-6 space-y-3 pb-24">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
              <span>Found <strong className="text-cyan-400">{filteredNodesList.length}</strong> regulatory circulars</span>
              <span className="text-[11px] text-slate-500">Sorted by citation weight</span>
            </div>

            {filteredNodesList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
                <Hash className="w-8 h-8 text-slate-600" />
                <p className="text-sm">No circulars match your search or filter.</p>
                <button
                  onClick={() => { setSelectedCorpus('all'); setSearchTerm(''); }}
                  className="text-xs text-cyan-400 underline hover:text-cyan-300"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredNodesList.map((node) => {
                  const corpusKey = getCorpusKey(node.corpus);
                  const colorConfig = CORPUS_COLORS[corpusKey] || CORPUS_COLORS.unknown;
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer bg-slate-900/60 backdrop-blur-md hover:bg-slate-800/80 flex flex-col justify-between gap-3 ${
                        isSelected 
                          ? 'border-cyan-400/80 shadow-[0_0_20px_rgba(56,189,248,0.2)] bg-slate-800/90' 
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text}`}>
                            {node.corpus?.toUpperCase() || 'STATUTE'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            <strong>{node.citation_count || 0}</strong> citations
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-white leading-snug break-words">
                          {node.label || node.id}
                        </h3>
                        {node.title && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {node.title}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-medium">
                          Inspect Network <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAskAboutCircular(node);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all"
                        >
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          <span>Ask AI</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────── */}
        {/* Selected Node Metadata Inspector Drawer (Responsive)*/}
        {/* Desktop: Right Sidebar | Mobile: Sliding Bottom Sheet */}
        {/* ─────────────────────────────────────────────────── */}
        {selectedNode && (
          <div className="fixed md:absolute inset-x-0 bottom-0 md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:w-96 max-h-[85vh] md:max-h-none md:max-w-[calc(100vw-2rem)] bg-slate-950/95 backdrop-blur-2xl border-t md:border border-slate-800 rounded-t-3xl md:rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col z-40 animate-in slide-in-from-bottom md:slide-in-from-right duration-300">
            
            {/* Header / Dismiss */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="space-y-1">
                <span
                  className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${activeCorpusColor?.bg} ${activeCorpusColor?.border} ${activeCorpusColor?.text} font-bold`}
                >
                  {selectedNode.corpus?.toUpperCase() || 'STATUTORY ACT'}
                </span>
                <h3 className="text-sm font-black text-white leading-snug break-words">
                  {selectedNode.label || selectedNode.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs text-slate-300 custom-scrollbar pr-1">
              
              {/* Metrics Pills */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Incoming Citations</div>
                  <div className="text-xl font-black text-cyan-400 font-mono mt-1">
                    {selectedNode.citation_count || nodeDetails?.total_incoming || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Circulars relying on this</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Outgoing References</div>
                  <div className="text-xl font-black text-indigo-400 font-mono mt-1">
                    {selectedNode.outbound_count || nodeDetails?.total_outgoing || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Statutes cited by this</div>
                </div>
              </div>

              {/* Title / Description */}
              {selectedNode.title && (
                <div className="space-y-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3">
                  <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-cyan-400" /> Regulatory Subject
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">{selectedNode.title}</p>
                </div>
              )}

              {/* Inbound Citations List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Cited By ({nodeDetails?.incoming_citations?.length || 0})</span>
                  <span className="text-[9px] text-slate-500 font-mono">Tap to jump</span>
                </div>
                {isLoadingDetails ? (
                  <div className="h-14 flex items-center justify-center text-slate-500 font-mono text-[11px] animate-pulse">
                    Loading citation matrix...
                  </div>
                ) : (nodeDetails?.incoming_citations?.length || 0) > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {nodeDetails.incoming_citations.slice(0, 10).map((inc, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const targetNode = graphData.nodes.find(n => n.id === inc.source);
                          if (targetNode) setSelectedNode(targetNode);
                        }}
                        className="bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/60 rounded-xl p-2 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <span className="text-[11px] text-slate-300 truncate max-w-[200px] group-hover:text-cyan-400">
                          {inc.source}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No incoming citations recorded in this subset.</p>
                )}
              </div>

              {/* Outbound Citations List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                  <span>Cites Statutes ({nodeDetails?.outgoing_citations?.length || 0})</span>
                  <span className="text-[9px] text-slate-500 font-mono">Tap to jump</span>
                </div>
                {isLoadingDetails ? (
                  <div className="h-14 flex items-center justify-center text-slate-500 font-mono text-[11px] animate-pulse">
                    Loading statutory links...
                  </div>
                ) : (nodeDetails?.outgoing_citations?.length || 0) > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {nodeDetails.outgoing_citations.slice(0, 10).map((out, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const targetNode = graphData.nodes.find(n => n.id === out.target);
                          if (targetNode) setSelectedNode(targetNode);
                        }}
                        className="bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/60 rounded-xl p-2 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <span className="text-[11px] text-slate-300 truncate max-w-[200px] group-hover:text-indigo-400">
                          {out.target}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No statutory citations referenced.</p>
                )}
              </div>
            </div>

            {/* ── Action Footer: "Ask about this" ── */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <button
                onClick={() => handleAskAboutCircular(selectedNode)}
                className="w-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white font-bold py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all transform active:scale-95 text-xs"
              >
                <Sparkles className="w-4 h-4 text-cyan-200" />
                <span>Ask RegIQ AI about this circular</span>
                <MessageSquare className="w-3.5 h-3.5 opacity-80 ml-1" />
              </button>

              {selectedNode.url && (
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center text-[11px] text-slate-400 hover:text-white flex items-center justify-center gap-1.5 py-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> View Official Gazette Source
                </a>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
