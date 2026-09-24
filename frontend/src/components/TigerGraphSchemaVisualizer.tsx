import React, { useState } from 'react';
import { Database } from 'lucide-react';

interface SchemaNode {
  id: string;
  label: string;
  color: string;
  cx: number;
  cy: number;
  r: number;
  primaryKey: string;
  attributes: { name: string; type: string }[];
  description: string;
}

interface CustomEdge {
  from: string;
  to: string;
  label: string;
  reverseLabel: string;
  qx?: number;
  qy?: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export const TigerGraphSchemaVisualizer: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('Transaction');

  const nodes: SchemaNode[] = [
    {
      id: 'Customer',
      label: 'Customer',
      color: '#1d4ed8', // Blue
      cx: 110,
      cy: 110,
      r: 36,
      primaryKey: 'customer_id (STRING)',
      attributes: [
        { name: 'customer_id', type: 'STRING' },
        { name: 'risk_level', type: 'STRING' },
        { name: 'name', type: 'STRING' },
      ],
      description: 'Primary customer account entity owning credit/debit cards.',
    },
    {
      id: 'Card',
      label: 'Card',
      color: '#dc2626', // Red
      cx: 370,
      cy: 80,
      r: 36,
      primaryKey: 'card_id (STRING)',
      attributes: [
        { name: 'card_id', type: 'STRING' },
        { name: 'brand', type: 'STRING' },
        { name: 'stolen_flag', type: 'BOOL' },
        { name: 'card_type', type: 'STRING' },
      ],
      description: 'Payment card vertex connected to transactions and customer accounts.',
    },
    {
      id: 'Transaction',
      label: 'Transaction',
      color: '#ec4899', // Pink
      cx: 710,
      cy: 230,
      r: 40,
      primaryKey: 'TransactionID (STRING)',
      attributes: [
        { name: 'TransactionID', type: 'STRING' },
        { name: 'amount', type: 'DOUBLE' },
        { name: 'ts', type: 'DATETIME' },
        { name: 'risk_score', type: 'FLOAT' },
        { name: 'channel', type: 'STRING' },
        { name: 'product_code', type: 'STRING' },
        { name: 'disputed', type: 'BOOL' },
      ],
      description: 'Central transaction event node linking card, device, email, and billing region.',
    },
    {
      id: 'DeviceProfile',
      label: 'DeviceProfile',
      color: '#4338ca', // Indigo
      cx: 440,
      cy: 220,
      r: 35,
      primaryKey: 'device_id (STRING)',
      attributes: [
        { name: 'device_id', type: 'STRING' },
        { name: 'device_type', type: 'STRING' },
        { name: 'vpn_detected', type: 'BOOL' },
        { name: 'proxy_flag', type: 'BOOL' },
      ],
      description: 'Device profile used to conduct online transactions. Evaluates VPN/Proxy risk (R5).',
    },
    {
      id: 'EmailDomain',
      label: 'EmailDomain',
      color: '#10b981', // Emerald Green
      cx: 710,
      cy: 460,
      r: 36,
      primaryKey: 'domain_name (STRING)',
      attributes: [
        { name: 'domain_name', type: 'STRING' },
        { name: 'disposable', type: 'BOOL' },
        { name: 'risk_score', type: 'FLOAT' },
      ],
      description: 'Purchaser email domain service used for regional/disposable risk checks (R6).',
    },
    {
      id: 'BillingRegion',
      label: 'BillingRegion',
      color: '#06b6d4', // Cyan
      cx: 470,
      cy: 460,
      r: 36,
      primaryKey: 'region_code (STRING)',
      attributes: [
        { name: 'region_code', type: 'STRING' },
        { name: 'mismatch_flag', type: 'BOOL' },
        { name: 'country', type: 'STRING' },
      ],
      description: 'Geographic billing region vertex for checking foreign/regional mismatches.',
    },
    {
      id: 'ClosedCase',
      label: 'ClosedCase',
      color: '#84cc16', // Lime Green
      cx: 220,
      cy: 460,
      r: 38,
      primaryKey: 'case_id (STRING)',
      attributes: [
        { name: 'case_id', type: 'STRING' },
        { name: 'outcome', type: 'STRING' },
        { name: 'pattern', type: 'STRING' },
        { name: 'opened_at', type: 'DATETIME' },
        { name: 'closed_at', type: 'DATETIME' },
        { name: 'exposure_usd', type: 'DOUBLE' },
        { name: 'verdict', type: 'STRING' },
      ],
      description: 'Historical fraud investigation record used to evaluate repeat fraud networks (R7).',
    },
    {
      id: 'EvidenceRequest',
      label: 'EvidenceRequest',
      color: '#f472b6', // Light Pink
      cx: 70,
      cy: 300,
      r: 35,
      primaryKey: 'request_id (STRING)',
      attributes: [
        { name: 'request_id', type: 'STRING' },
        { name: 'status', type: 'STRING' },
        { name: 'request_type', type: 'STRING' },
        { name: 'created_at', type: 'DATETIME' },
      ],
      description: 'Pending evidence request requiring analyst response before auto-clearing (R2, R10).',
    },
  ];

  const edges: CustomEdge[] = [
    { from: 'Customer', to: 'Card', label: 'OWNS', reverseLabel: 'reverse_OWNS' },
    { from: 'Card', to: 'Transaction', label: 'MADE', reverseLabel: 'reverse_MADE' },
    { from: 'Transaction', to: 'DeviceProfile', label: 'FROM_DEVICE', reverseLabel: 'reverse_FROM_DEVICE' },
    { from: 'Transaction', to: 'EmailDomain', label: 'PURCHASER_EMAIL', reverseLabel: 'reverse_PURCHASER_EMAIL' },
    { from: 'Transaction', to: 'BillingRegion', label: 'BILLED_IN', reverseLabel: 'reverse_BILLED_IN' },
    {
      from: 'Transaction',
      to: 'ClosedCase',
      label: 'INVOLVES',
      reverseLabel: 'reverse_INVOLVES',
      qx: 480,
      qy: 330,
    },
    {
      from: 'ClosedCase',
      to: 'Card',
      label: 'CONNECTED_TO',
      reverseLabel: 'reverse_CONNECTED_TO',
      qx: 230,
      qy: 250,
      labelOffsetX: -10,
      labelOffsetY: 0,
    },
    {
      from: 'ClosedCase',
      to: 'Card',
      label: 'ON_CARD',
      reverseLabel: 'reverse_ON_CARD',
      qx: 310,
      qy: 270,
      labelOffsetX: 10,
      labelOffsetY: 0,
    },
    { from: 'EvidenceRequest', to: 'ClosedCase', label: 'FOR_CASE', reverseLabel: 'reverse_FOR_CASE', labelOffsetY: 10 },
    {
      from: 'EvidenceRequest',
      to: 'Transaction',
      label: 'FOR_TRANSACTION',
      reverseLabel: 'reverse_FOR_TRANSACTION',
      qx: 380,
      qy: 390,
      labelOffsetY: 12,
    },
  ];

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[2];

  const getNodeCenter = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    return node ? { x: node.cx, y: node.cy } : { x: 0, y: 0 };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Container Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database className="w-4 h-4" style={{ color: '#ff6700' }} />
            TigerGraph FraudGraph Schema Topology (Live Interactive Inspector)
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Exact schema map matching TigerGraph Graph Studio. Click any vertex node to view attributes & indexing.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', background: 'var(--bg-raised)', borderRadius: 4, color: 'var(--text-secondary)' }}>
            8 Vertex Types
          </span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', background: 'var(--bg-raised)', borderRadius: 4, color: 'var(--text-secondary)' }}>
            11 Directed Edge Types
          </span>
        </div>
      </div>

      {/* Main Canvas & Inspector Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
        
        {/* SVG Diagram Canvas */}
        <div
          className="card"
          style={{
            position: 'relative',
            height: 540,
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Subtle Grid Background */}
          <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern id="tg-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
              </pattern>
              <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.35)" />
              </marker>
              <marker id="arrow-selected" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff6700" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#tg-grid)" />

            {/* Render Edges & Edge Label Pills */}
            {edges.map((edge, idx) => {
              const start = getNodeCenter(edge.from);
              const end = getNodeCenter(edge.to);
              const isConnectedToSelected = edge.from === selectedNodeId || edge.to === selectedNodeId;

              let pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
              let midX = (start.x + end.x) / 2;
              let midY = (start.y + end.y) / 2;

              if (edge.qx !== undefined && edge.qy !== undefined) {
                pathD = `M ${start.x} ${start.y} Q ${edge.qx} ${edge.qy} ${end.x} ${end.y}`;
                // Quadratic bezier curve midpoint approximation at t=0.5
                midX = 0.25 * start.x + 0.5 * edge.qx + 0.25 * end.x;
                midY = 0.25 * start.y + 0.5 * edge.qy + 0.25 * end.y;
              }

              if (edge.labelOffsetX) midX += edge.labelOffsetX;
              if (edge.labelOffsetY) midY += edge.labelOffsetY;

              const textWidth = edge.label.length * 6.2 + 10;

              return (
                <g key={idx}>
                  {/* Edge Path Line */}
                  <path
                    d={pathD}
                    stroke={isConnectedToSelected ? '#ff6700' : 'rgba(255, 255, 255, 0.22)'}
                    strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                    strokeDasharray={isConnectedToSelected ? 'none' : '4 2'}
                    fill="none"
                    markerEnd={isConnectedToSelected ? 'url(#arrow-selected)' : 'url(#arrow)'}
                  />

                  {/* Background Pill behind edge label to eliminate line overlapping */}
                  <rect
                    x={midX - textWidth / 2}
                    y={midY - 9}
                    width={textWidth}
                    height="17"
                    rx="4"
                    fill="#0d1117"
                    stroke={isConnectedToSelected ? '#ff6700' : 'rgba(255, 255, 255, 0.15)'}
                    strokeWidth="1"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* Edge Label Text */}
                  <text
                    x={midX}
                    y={midY + 3}
                    fill={isConnectedToSelected ? '#ff6700' : '#8b949e'}
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isConnectedToSelected ? '700' : '500'}
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Render Nodes */}
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer selection ring */}
                  {isSelected && (
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r={node.r + 7}
                      fill="none"
                      stroke="#ff6700"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.r}
                    fill={node.color}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 3 : 1.5}
                    style={{
                      transition: 'all 0.2s ease',
                      filter: isSelected ? 'drop-shadow(0 0 14px ' + node.color + ')' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
                    }}
                  />

                  {/* Label Inside Node */}
                  <text
                    x={node.cx}
                    y={node.cy + 3.5}
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="Inter, sans-serif"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Canvas Footer Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 14,
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#8b949e',
              background: 'rgba(13, 17, 23, 0.88)',
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #21262d',
            }}
          >
            ● Graph Studio FraudGraph Schema (Zero Overlap Topology)
          </div>
        </div>

        {/* Selected Vertex Inspector Panel */}
        <div
          className="card"
          style={{
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: selectedNode.color,
                boxShadow: `0 0 10px ${selectedNode.color}`,
              }}
            />
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Vertex Inspector
              </span>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedNode.label}
              </h4>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {selectedNode.description}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Primary Key / ID
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                padding: '6px 10px',
                borderRadius: 5,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                color: '#ff6700',
                fontWeight: 600,
              }}
            >
              {selectedNode.primaryKey}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Schema Attributes ({selectedNode.attributes.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {selectedNode.attributes.map((attr, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: 4,
                    background: 'var(--bg-raised)',
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{attr.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{attr.type}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Connected Directed Edges
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {edges
                .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                .map((e, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 10.5,
                      fontFamily: 'monospace',
                      padding: '5px 8px',
                      borderRadius: 4,
                      background: 'rgba(255, 103, 0, 0.06)',
                      border: '1px solid rgba(255, 103, 0, 0.2)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{e.from === selectedNode.id ? `→ ${e.label} (${e.to})` : `← ${e.reverseLabel} (${e.from})`}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
