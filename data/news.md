<!-- GENERATED FILE — do not edit by hand. Edit data/news.json and regenerate. -->

# agent² — AI news

_Last updated: 2026-06-05 · 41 items_

## ★ Highlights

- **[Multi-Agent Computer Use](https://arxiv.org/abs/2606.01533)** — arXiv · 2026-06-01
  Introduces MACU, a framework where a manager model decomposes tasks into dependency DAGs executed by parallel subagents; achieves 3.4–25.5% gains across OSWorld, Mind2Web, WebTailBench, and Odysseys benchmarks with ~1.5× faster wall-clock completion on long-horizon tasks versus single-agent baselines.
- **[Google Antigravity 2.0: agent-first development platform](https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/)** — Google · 2026-05-19
  At Google I/O 2026, Google launched Antigravity 2.0, a standalone desktop app built around orchestrating multiple agents in parallel, alongside an Antigravity CLI, SDK, Managed Agents in the Gemini API, and enterprise support.
- **[Introducing Claude Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8)** — Anthropic · 2026-05-28
  Anthropic's new flagship model, with gains in software engineering and long-running coding tasks plus higher-resolution vision.
- **[The 2026-07-28 MCP Specification Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)** — Model Context Protocol Blog · 2026-05-21
  Release candidate for the next Model Context Protocol spec: a stateless protocol core, an Extensions framework, a Tasks lifecycle, and OAuth-aligned authorization. Final spec targeted for July 28, 2026.
- **[Gemini 3.5: frontier intelligence with action](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/)** — Google · 2026-05-19
  Google's new Gemini model series balancing high speed with stronger agentic, action-taking capabilities; unveiled at Google I/O 2026.

## Model Release

- **[Introducing Claude Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8)** — Anthropic · 2026-05-28
  Anthropic's new flagship model, with gains in software engineering and long-running coding tasks plus higher-resolution vision.
- **[Gemini 3.5: frontier intelligence with action](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/)** — Google · 2026-05-19
  Google's new Gemini model series balancing high speed with stronger agentic, action-taking capabilities; unveiled at Google I/O 2026.

## Agent Framework

- **[Hermes Agent v0.15.0 — The Velocity Release](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.5.28)** — GitHub · 2026-05-28
  Major Nous Research update to the open-source Hermes agent: multi-agent kanban with auto-decomposition and swarm topology, session_search rebuilt as a zero-LLM tool (4,500× faster), 63% cold-start reduction, and promptware injection defenses.
- **[Datasette Agent: an extensible AI assistant for Datasette](https://simonwillison.net/2026/May/21/datasette-agent/)** — Simon Willison · 2026-05-21
  Simon Willison's open-source Datasette plugin providing a conversational interface over SQLite, built on the LLM library with support for hundreds of tool-calling models from frontier and open-weight vendors.
- **[Google Antigravity 2.0: agent-first development platform](https://blog.google/innovation-and-ai/technology/developers-tools/google-io-2026-developer-highlights/)** — Google · 2026-05-19
  At Google I/O 2026, Google launched Antigravity 2.0, a standalone desktop app built around orchestrating multiple agents in parallel, alongside an Antigravity CLI, SDK, Managed Agents in the Gemini API, and enterprise support.
- **[Gemini Spark: a 24/7 personal AI agent](https://blog.google/innovation-and-ai/sundar-pichai-io-2026/)** — Google · 2026-05-19
  Google's personal AI agent in the Gemini app, powered by Gemini 3.5 and the Antigravity harness on dedicated Google Cloud VMs. Runs long-horizon tasks in the background, integrates Gmail/Workspace, and adds third-party tools via MCP. Rolling out to trusted testers and AI Ultra subscribers.
- **[Microsoft Agent Framework 1.7.0 (Python)](https://github.com/microsoft/agent-framework/releases)** — GitHub · 2026-05-28
  Latest release of Microsoft's Agent Framework adds HarnessAgent, A2A agent sessions, and experimental prompt-to-agent conversion APIs.
- **[Hermes Unlocks Self-Improving AI Agents on NVIDIA RTX PCs and DGX Spark](https://blogs.nvidia.com/blog/rtx-ai-garage-hermes-agent-dgx-spark/)** — NVIDIA Blog · 2026-05-13
  Nous Research's open-source Hermes framework for reliable, self-improving agents optimized to run locally on NVIDIA RTX PCs and DGX Spark.

## Tooling & Infra

- **[Statewright: State Machine Guardrails for AI Agents](https://github.com/statewright/statewright)** — GitHub
  Open-source tool that enforces phase-based tool access for coding agents — planning gets read-only tools, implementation unlocks edits, testing restricts to test commands — via MCP integration; works with Claude Code, Codex, Cursor, and others.
- **[The 2026-07-28 MCP Specification Release Candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)** — Model Context Protocol Blog · 2026-05-21
  Release candidate for the next Model Context Protocol spec: a stateless protocol core, an Extensions framework, a Tasks lifecycle, and OAuth-aligned authorization. Final spec targeted for July 28, 2026.
- **[Introducing Claude Design by Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs)** — Anthropic · 2026-04-17
  An Anthropic Labs product for collaborating with Claude to produce visual outputs: designs, prototypes, slides, and one-pagers.
- **[Codex for (almost) everything](https://openai.com/index/codex-for-almost-everything/)** — OpenAI · 2026-04-16
  Major Codex update: it can now operate your computer alongside you, work natively with the web via an in-app browser, and adds 90+ new plugins.

## Research

### Agents & Multi-Agent

- **[Channel Fracture: Architectural Blind Spots in Scheduled Cross-Agent Memory Injection](https://arxiv.org/abs/2606.04896)** — arXiv · 2026-06-03
  Identifies a silent failure mode in multi-agent deployments where cron-scheduled agents cannot write to another agent's persistent memory due to hardcoded isolation guards; tested on a production Hermes Agent deployment and proposes CADVP v1.1, a 13-dimension verification framework.
- **[Multi-Agent Computer Use](https://arxiv.org/abs/2606.01533)** — arXiv · 2026-06-01
  Introduces MACU, a framework where a manager model decomposes tasks into dependency DAGs executed by parallel subagents; achieves 3.4–25.5% gains across OSWorld, Mind2Web, WebTailBench, and Odysseys benchmarks with ~1.5× faster wall-clock completion on long-horizon tasks versus single-agent baselines.
- **[MetaForge: A Self-Evolving Multimodal Agent that Retrieves, Adapts, and Forges Tools On Demand](https://arxiv.org/abs/2606.01801)** — arXiv · 2026-06-01
  An agent framework that dynamically synthesizes new tools when existing ones are insufficient, penalizes unnecessary tool calls, and makes forged tools reusable; evaluated on 12 benchmarks with improvements in accuracy, efficiency, and generalization to unfamiliar scenarios.
- **[Doing What They Say, Not What They Reason: Locating the Faithfulness Gap in LLM Agents](https://arxiv.org/abs/2606.00476)** — arXiv · 2026-05-30
  Uses a Texas Poker simulator as a ground-truth testbed to measure whether agents act on their stated reasoning; finds the gap divides into reasoning-to-conclusion and conclusion-to-action stages that behave oppositely, with implications for using LLMs in social simulation.
- **[Scaling Behavior of Single LLM-Driven Multi-Agent Systems](https://arxiv.org/abs/2606.00655)** — arXiv · 2026-05-30
  Studies how LLM-based multi-agent systems scale with agent count using the SIMAS framework; finds diminishing returns rather than linear gains, driven by coordination overhead rather than context length, with optimal agent count varying significantly by task type.

### Benchmarks & Evals

- **[ForeSci: Evaluating LLM Agents for Forward-Looking AI Research Judgment](https://arxiv.org/abs/2606.00644)** — arXiv · 2026-05-30
  A 500-task benchmark spanning four AI domains and four decision categories that tests whether LLM agents can make research predictions from historical information; finds 'evidence-decision decoupling' — agents cite relevant sources but still forecast incorrect outcomes.
- **[What Twelve LLM Agent Benchmark Papers Disclose About Themselves](https://arxiv.org/abs/2605.21404)** — arXiv · 2026-05-20
  A pilot audit of twelve LLM agent benchmark papers finds a mean disclosure score of 0.38 (vs 0.66 for classical benchmarks), with no agent paper reporting inference cost; the authors release an open scoring schema and codebook.
- **[Cattle Trade: A Multi-Agent Benchmark for LLM Bluffing, Bidding, and Bargaining](https://arxiv.org/abs/2605.14537)** — arXiv · 2026-05-14
  An arXiv benchmark evaluating LLMs as strategic agents under imperfect information across a 50–60 turn game of auctions, bargaining, and bluffing; some heuristic code agents outperformed most tested LLMs.
- **[GroupMemBench: Benchmarking LLM Agent Memory in Multi-Party Conversations](https://arxiv.org/abs/2605.14498)** — arXiv · 2026-05-14
  New arXiv benchmark for evaluating LLM agent memory across multi-party conversations, exposing notable gaps in current memory systems.

### Safety & Alignment

- **[Capability Advertisement as a Market for Lemons: A Trust Layer for Heterogeneous Agent Networks](https://arxiv.org/abs/2606.03034)** — arXiv · 2026-06-02
  Argues that agent capability claims in MCP/A2A delegation suffer from Akerlof's market-for-lemons problem — callers cannot distinguish reliable providers from fluent impostors — and proposes a protocol-agnostic trust layer using probabilistic descriptors, screening, and reputation mechanisms.
- **[Privacy Preserving ML Workflow: Personalized Differential Privacy Budgets in Federated Learning](https://arxiv.org/abs/2605.02372)** — arXiv · 2026-05-04
  A federated learning workflow for sensitive tabular data that assigns per-client differential privacy budgets based on a re-identification risk metric, improving utility over fixed global budgets.
- **[Reward Hacking Benchmark: Measuring Exploits in LLM Agents with Tool Use](https://arxiv.org/abs/2605.02964)** — arXiv · 2026-05-03
  A suite of multi-step tool-use tasks with naturalistic shortcuts; evaluating 13 frontier models finds RL post-training substantially increases reward hacking, with exploit rates from 0% to 13.9%.
- **[Position: Safety and Fairness in Agentic AI Depend on Interaction Topology, Not Model Scale or Alignment](https://arxiv.org/abs/2605.01147)** — arXiv · 2026-05-01
  Argues multi-agent safety hinges on how agents are wired together, identifying topology-driven failures (ordering instability, information cascades) that persist across model scales and alignment.

### AI for Science

- **[AI Research Agents Narrow Scientific Exploration](https://arxiv.org/abs/2605.27905)** — arXiv · 2026-05-27
  Analyzes 37,802 ideas from four AI research-agent frameworks and six LLMs, finding generated ideas concentrate around existing work rather than broadening exploration.
- **[Protein Thoughts: Interpretable Reasoning with Tree of Thoughts for Protein-Protein Interaction Discovery](https://arxiv.org/abs/2605.21522)** — arXiv · 2026-05-19
  Reformulates protein-protein interaction discovery as an interpretable tree-of-thoughts search over four biologically meaningful signals, with embedding-space flow matching for mechanistic justification.
- **[AlphaEvolve: a Gemini-powered coding agent scaling impact across fields](https://deepmind.google/blog/alphaevolve-impact/)** — Google DeepMind · 2026-05-07
  Google DeepMind's Gemini-powered coding agent shows real-world impact across genomics, power-grid optimization, quantum physics, and mathematics.

### Multimodal & Generation

- **[Paris 2.0: A Decentralized Diffusion Model for Video Generation](https://arxiv.org/abs/2605.26064)** — arXiv · 2026-05-25
  The first video generation model trained through decentralized computation, reporting roughly 2x better video quality than centralized training at equivalent compute.
- **[Nano World Models: A Minimalist Implementation of Future Video Prediction](https://arxiv.org/abs/2605.23993)** — arXiv · 2026-05-17
  A compact, reproducible codebase for studying world models and future video prediction, with a unified interface over generative objectives, model scales, and action-conditioning mechanisms.
- **[Mamoda2.5: Enhancing Unified Multimodal Model with DiT-MoE](https://arxiv.org/abs/2605.02641)** — arXiv · 2026-05-04
  A unified AR-diffusion model combining multimodal understanding and generation, using a Diffusion Transformer with a 128-expert Top-8 MoE (25B params, 3B active) and strong VBench 2.0 / video-editing results.

### Efficiency & Inference

- **[Quant.npu: Efficient Mobile NPU Inference for On-Device LLMs via Fully Static Quantization](https://arxiv.org/abs/2605.20295)** — arXiv · 2026-05-19
  A fully static, integer-only quantization framework using learnable quantization parameters and rotation matrices to run LLMs efficiently on mobile NPUs, cutting inference latency.
- **[Compute Where it Counts: Self-Optimizing Language Models](https://arxiv.org/abs/2605.10875)** — arXiv · 2026-05-11
  Pairs a frozen LLM with a lightweight policy network that allocates compute per token by controlling attention sparsity, activation pruning, and quantization bit-width, improving the quality–efficiency frontier.

### Training & Learning

- **[Rethinking RL for LLM Reasoning: It's Sparse Policy Selection, Not Capability Learning](https://arxiv.org/abs/2605.06241)** — arXiv · 2026-05-07
  Argues RL improves reasoning by sparsely selecting policy at uncertain decision points rather than teaching new capabilities, motivating a far cheaper post-training method (ReasonMaxxer).

### Interpretability

- **[Patch-Effect Graph Kernels for LLM Interpretability](https://arxiv.org/abs/2605.06480)** — arXiv · 2026-05-07
  Reframes mechanistic interpretability as a graph ML problem, representing activation-patching profiles as graphs over model components and using graph kernels to identify causal circuits.

## Big Lab Update

- **[Anthropic forms $200 million partnership with the Gates Foundation](https://www.anthropic.com/news/gates-foundation-partnership)** — Anthropic · 2026-05-14
  A four-year partnership providing grant funding, Claude usage credits, and technical support for AI applications in global health, life sciences, education, and economic mobility.
- **[Anthropic raises $65B Series H at $965B post-money valuation](https://www.anthropic.com/news/series-h)** — Anthropic · 2026-05-28
  Anthropic's latest raise signals continued scaling of compute and research investment.

## Community & Discussion

- **[Designing Agentic Memory in 2026](https://thenuancedperspective.substack.com/p/designing-agentic-memory-in-2026)** — The Nuanced Perspective · 2026-05-16
  Substantive Substack analysis of five memory design mistakes in production agent systems — collapsing distinct memory types, using human-trained retrievers, not compounding memory across sessions, and ignoring poisoning vulnerabilities — grounded in four 2026 research papers.
- **[I think Anthropic and OpenAI have found product-market fit](https://simonwillison.net/2026/May/27/product-market-fit/)** — Simon Willison · 2026-05-27
  Simon Willison argues coding agents (Claude Code/Cowork, Codex) have become daily drivers for well-paid professionals, citing his own ~$2,180/month in usage and April 2026 as the revenue inflection point.
- **[Live blog: Code w/ Claude 2026](https://simonwillison.net/2026/May/6/code-w-claude-2026/)** — Simon Willison · 2026-05-06
  Simon Willison's live blog of Anthropic's Code with Claude 2026: higher Claude Code rate limits, multi-agent orchestration and 'Dreaming' for Managed Agents, and a SpaceX/Colossus compute partnership.
- **[State of AI: May 2026](https://press.airstreet.com/p/state-of-ai-may-2026)** — Air Street Press · 2026-05-04
  Nathan Benaich's monthly State of AI roundup covering frontier cyber capabilities, shifting lab partnerships, Chinese open-weight coding models, and agent performance in live markets.

