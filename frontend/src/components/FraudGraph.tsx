import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  User,
  CreditCard,
  DollarSign,
  Smartphone,
  Mail,
  MapPin,
  Folder,
  FileText,
  Search,
  Filter,
  Maximize2,
  RotateCcw,
  X,
  Info,
  ShieldAlert,
} from 'lucide-react';

import { apiService } from '../services/api';
import { CaseGraphResponse, GraphNode as ApiGraphNode } from '../types/investigation';

interface FraudGraphProps {
  caseId: string;
  onSelectTransaction?: (transactionId: string) => void;
}

// ---------------------------------------------------------------------------
// Entity Type Config & Professional Color Palette
// ---------------------------------------------------------------------------
const ENTITY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.FC<{ className?: string }>;
    badgeBg: string;
    badgeText: string;
    nodeBg: string;
    nodeBorder: string;
    accentColor: string;
  }
> = {
  Customer: {
    label: 'Customer',
    icon: User,
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-blue-200 dark:border-blue-800/60',
    accentColor: '#2563eb',
  },
  Card: {
    label: 'Card',
    icon: CreditCard,
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-indigo-200 dark:border-indigo-800/60',
    accentColor: '#4f46e5',
  },
  Transaction: {
    label: 'Transaction',
    icon: DollarSign,
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    accentColor: '#059669',
  },
  DeviceProfile: {
    label: 'Device',
    icon: Smartphone,
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-purple-200 dark:border-purple-800/60',
    accentColor: '#7c3aed',
  },
  EmailDomain: {
    label: 'Email Domain',
    icon: Mail,
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-amber-200 dark:border-amber-800/60',
    accentColor: '#d97706',
  },
  BillingRegion: {
    label: 'Billing Region',
    icon: MapPin,
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-rose-200 dark:border-rose-800/60',
    accentColor: '#e11d48',
  },
  ClosedCase: {
    label: 'Case',
    icon: Folder,
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-slate-300 dark:border-slate-700',
    accentColor: '#475569',
  },
  EvidenceRequest: {
    label: 'Evidence Request',
    icon: FileText,
    badgeBg: 'bg-yellow-50 dark:bg-yellow-950/60',
    badgeText: 'text-yellow-800 dark:text-yellow-300',
    nodeBg: 'bg-white dark:bg-slate-900',
    nodeBorder: 'border-yellow-300 dark:border-yellow-700',
    accentColor: '#ca8a04',
  },
};

// ---------------------------------------------------------------------------
// Enterprise Custom Node Component
// ---------------------------------------------------------------------------
const CustomGraphNode: React.FC<{ data: any; selected: boolean }> = ({ data, selected }) => {
  const nodeType = data.type || 'ClosedCase';
  const config = ENTITY_CONFIG[nodeType] || ENTITY_CONFIG.ClosedCase;
  const IconComponent = config.icon;
  const isCurrentCase = data.properties?.is_current_case;
  const isDimmed = data.isDimmed;
  const isHighlighted = data.isHighlighted;

  return (
    <div
      className={`px-3 py-2 rounded-lg border shadow-sm transition-all duration-150 cursor-pointer text-xs min-w-[140px] max-w-[210px] ${
        config.nodeBg
      } ${
        isCurrentCase
          ? 'ring-2 ring-blue-600 border-blue-600 dark:ring-blue-500 shadow-blue-500/10'
          : selected || isHighlighted
          ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-indigo-500/10'
          : config.nodeBorder
      } ${isDimmed ? 'opacity-35 grayscale-[40%]' : 'opacity-100 hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600'}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-300 dark:!bg-slate-600 !w-1.5 !h-1.5" />

      <div className="flex items-center gap-2">
        <div className={`p-1 rounded ${config.badgeBg} ${config.badgeText}`}>
          <IconComponent className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate text-[11px]">
              {data.label}
            </span>
          </div>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 block font-sans uppercase tracking-wider">
            {config.label}
          </span>
        </div>
      </div>

      {isCurrentCase && (
        <div className="mt-1.5">
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
            CURRENT INVESTIGATION
          </span>
        </div>
      )}

      {nodeType === 'Transaction' && data.properties?.amount && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
            ${Number(data.properties.amount).toFixed(2)}
          </span>
          {data.properties.risk_signal !== undefined && data.properties.risk_signal !== null && (
            <span className="text-[9px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              Risk: {data.properties.risk_signal}
            </span>
          )}
        </div>
      )}

      {nodeType === 'EvidenceRequest' && data.properties?.status && (
        <div className="mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span
            className={`inline-block px-1.5 py-0.2 rounded text-[8px] font-mono font-semibold ${
              data.properties.status === 'PENDING'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200'
            }`}
          >
            {data.properties.status}
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 dark:!bg-slate-600 !w-1.5 !h-1.5" />
    </div>
  );
};

const nodeTypes = { custom: CustomGraphNode };

// ---------------------------------------------------------------------------
// Canvas Container Component
// ---------------------------------------------------------------------------
const FraudGraphCanvas: React.FC<FraudGraphProps> = ({ caseId, onSelectTransaction }) => {
  const { fitView } = useReactFlow();

  const [graphData, setGraphData] = useState<CaseGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] = useState<ApiGraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFoundId, setSearchFoundId] = useState<string | null>(null);

  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    Customer: true,
    Card: true,
    Transaction: true,
    DeviceProfile: true,
    EmailDomain: true,
    BillingRegion: true,
    ClosedCase: true,
    EvidenceRequest: true,
  });

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getCaseGraph(caseId);
      setGraphData(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load graph visualization');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!graphData) return;

    const filteredApiNodes = graphData.nodes.filter(
      (n) => visibleCategories[n.type] !== false
    );
    const filteredNodeIds = new Set(filteredApiNodes.map((n) => n.id));
    const filteredApiEdges = graphData.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );

    const levels: Record<string, number> = {
      ClosedCase: 0,
      EvidenceRequest: 0,
      Customer: 1,
      Card: 2,
      Transaction: 3,
      DeviceProfile: 4,
      BillingRegion: 4,
      EmailDomain: 4,
    };

    const nodesByLevel: Record<number, ApiGraphNode[]> = {};
    filteredApiNodes.forEach((node) => {
      const lvl = levels[node.type] ?? 2;
      if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
      nodesByLevel[lvl].push(node);
    });

    const flowNodes: Node[] = [];
    const levelSpacingY = 120;
    const nodeSpacingX = 170;

    Object.keys(nodesByLevel).forEach((lvlStr) => {
      const lvl = parseInt(lvlStr, 10);
      const levelNodes = nodesByLevel[lvl];
      const totalWidth = (levelNodes.length - 1) * nodeSpacingX;
      const startX = -totalWidth / 2;

      levelNodes.forEach((node, index) => {
        const isSelected = selectedNode?.id === node.id;
        const isHighlighted = searchFoundId === node.id;
        const isDimmed =
          selectedNode || searchFoundId
            ? !(
                node.id === (selectedNode?.id || searchFoundId) ||
                filteredApiEdges.some(
                  (e) =>
                    (e.source === node.id && (e.target === selectedNode?.id || e.target === searchFoundId)) ||
                    (e.target === node.id && (e.source === selectedNode?.id || e.source === searchFoundId))
                )
              )
            : false;

        flowNodes.push({
          id: node.id,
          type: 'custom',
          position: {
            x: startX + index * nodeSpacingX,
            y: lvl * levelSpacingY,
          },
          data: {
            ...node,
            isSelected,
            isHighlighted,
            isDimmed,
          },
        });
      });
    });

    const flowEdges: Edge[] = filteredApiEdges.map((e) => {
      const isConnectedToSelected =
        selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isConnectedToSelected ? true : false,
        style: {
          stroke: isConnectedToSelected ? '#2563eb' : selectedNode ? '#e2e8f0' : '#94a3b8',
          strokeWidth: isConnectedToSelected ? 2.5 : 1.25,
          opacity: selectedNode && !isConnectedToSelected ? 0.25 : 0.85,
        },
        labelStyle: {
          fill: '#64748b',
          fontWeight: 500,
          fontSize: 9,
          fontFamily: 'JetBrains Mono, monospace',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isConnectedToSelected ? '#2563eb' : '#94a3b8',
          width: 12,
          height: 12,
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);

    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 40);
  }, [graphData, visibleCategories, selectedNode, searchFoundId, fitView, setNodes, setEdges]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !graphData) return;

    const query = searchQuery.trim().toLowerCase();
    const match = graphData.nodes.find((n) => {
      const idMatch = n.id.toLowerCase().includes(query);
      const labelMatch = n.label.toLowerCase().includes(query);
      const propValuesMatch = Object.values(n.properties || {}).some((v) =>
        String(v).toLowerCase().includes(query)
      );
      return idMatch || labelMatch || propValuesMatch;
    });

    if (match) {
      setSelectedNode(match);
      setSearchFoundId(match.id);
      if (match.type === 'Transaction' && onSelectTransaction && match.properties?.transaction_id) {
        onSelectTransaction(match.properties.transaction_id);
      }
    } else {
      setSearchFoundId(null);
    }
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const apiNode = graphData?.nodes.find((n) => n.id === node.id);
    if (apiNode) {
      setSelectedNode(apiNode);
      setSearchFoundId(apiNode.id);
      if (apiNode.type === 'Transaction' && onSelectTransaction && apiNode.properties?.transaction_id) {
        onSelectTransaction(apiNode.properties.transaction_id);
      }
    }
  };

  const toggleCategory = (cat: string) => {
    setVisibleCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleReset = () => {
    setSelectedNode(null);
    setSearchQuery('');
    setSearchFoundId(null);
    setVisibleCategories({
      Customer: true,
      Card: true,
      Transaction: true,
      DeviceProfile: true,
      EmailDomain: true,
      BillingRegion: true,
      ClosedCase: true,
      EvidenceRequest: true,
    });
    fitView({ padding: 0.2, duration: 300 });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-2" />
        <span className="text-xs font-mono text-slate-500">Retrieving TigerGraph FraudGraph Topology…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/40 p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500 mb-2" />
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
          Graph Network Service Offline
        </h3>
        <p className="text-xs text-red-600 dark:text-red-400 max-w-md mb-3">{error}</p>
        <button
          onClick={loadGraph}
          className="btn btn-ghost text-xs"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[520px] bg-slate-50/70 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col font-sans">
      {/* Sleek Sub-Header Toolbar */}
      <div className="z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Title */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            INVESTIGATION GRAPH
          </span>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {caseId}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter className="w-3 h-3 text-slate-400 shrink-0 mr-1" />
          {Object.keys(ENTITY_CONFIG).map((cat) => {
            const cfg = ENTITY_CONFIG[cat];
            const active = visibleCategories[cat];
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition shrink-0 ${
                  active
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                    : 'bg-transparent text-slate-400 opacity-50 hover:opacity-100'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Entity ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[11px] font-mono rounded border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 w-36"
            />
          </form>

          <button
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition"
            title="Fit View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="relative flex-1 w-full h-full bg-slate-50/50 dark:bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          colorMode="light"
        >
          <Background color="#cbd5e1" gap={24} size={1} />
          <Controls className="!bg-white !border-slate-200 !shadow-sm !text-slate-700" />
        </ReactFlow>

        {/* Selected Node Details Docked Side Panel */}
        {selectedNode && (
          <div className="absolute right-3 top-3 bottom-3 w-80 bg-slate-900/95 text-slate-100 backdrop-blur border border-slate-800 rounded-lg shadow-xl p-3.5 overflow-y-auto z-20 flex flex-col text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                {React.createElement(ENTITY_CONFIG[selectedNode.type]?.icon || Info, {
                  className: `w-4 h-4 ${ENTITY_CONFIG[selectedNode.type]?.badgeText || 'text-slate-400'}`,
                })}
                <div>
                  <h4 className="font-mono font-semibold text-slate-100 text-xs">
                    {selectedNode.label}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider block">
                    {ENTITY_CONFIG[selectedNode.type]?.label || selectedNode.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Properties */}
            <div className="space-y-2 flex-1">
              {Object.entries(selectedNode.properties || {}).map(([key, val]) => {
                if (val === null || val === undefined || val === '') return null;
                if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) return null;

                let label = key.replace(/_/g, ' ').toUpperCase();
                let displayVal = String(val);

                if (key === 'risk_signal' || key === 'risk_score') {
                  label = 'RISK SIGNAL';
                }
                if (key === 'amount') {
                  displayVal = `$${Number(val).toFixed(2)}`;
                }

                return (
                  <div key={key} className="bg-slate-800/90 p-2.5 rounded border border-slate-700/80">
                    <span className="text-[9px] font-mono font-semibold text-slate-400 block mb-1 tracking-wider">{label}</span>
                    <span className="font-mono text-xs font-medium text-slate-100 break-words">{displayVal}</span>
                  </div>
                );
              })}

              {/* Directly Connected Nodes */}
              <div className="pt-2 border-t border-slate-800 mt-3">
                <span className="text-[9px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Topology Connections
                </span>
                <div className="space-y-1">
                  {graphData?.edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e) => {
                      const otherId = e.source === selectedNode.id ? e.target : e.source;
                      const otherNode = graphData.nodes.find((n) => n.id === otherId);
                      return (
                        <div
                          key={e.id}
                          onClick={() => otherNode && setSelectedNode(otherNode)}
                          className="p-2 bg-slate-800/80 hover:bg-slate-700/80 rounded border border-slate-700/80 cursor-pointer flex items-center justify-between text-[11px] transition"
                        >
                          <span className="font-mono text-[10px] text-blue-400 font-semibold">{e.type}</span>
                          <span className="font-mono text-slate-200 truncate max-w-[140px]">
                            {otherNode?.label || otherId}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const FraudGraph: React.FC<FraudGraphProps> = (props) => (
  <ReactFlowProvider>
    <FraudGraphCanvas {...props} />
  </ReactFlowProvider>
);

export default FraudGraph;
