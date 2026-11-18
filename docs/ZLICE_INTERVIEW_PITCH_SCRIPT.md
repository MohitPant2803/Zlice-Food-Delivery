# 🎙️ Zlice: The 2.5-Minute System Pitch & Interview Script
## Master Word-for-Word Delivery for Big Tech / FAANG Technical Interviews

---

## ⏱️ Section-by-Section Script Breakdown

```
[0:00 - 0:20] 1. Problem and Scale (15-20s)
[0:20 - 0:50] 2. High-Level Picture & Architecture (30s)
[0:50 - 1:45] 3. One Core Flow, End-to-End (50-55s)
[1:45 - 2:20] 4. Key Design Decisions & Trade-offs (35s)
[2:20 - 2:45] 5. Hard Problem: Concurrent Double-Assignment (25s)
[2:45 - 3:05] 6. Limitations & What Breaks at 100x Scale (20s)
[3:05 - 3:15] 7. Stop and Invite Questions (10s)
```

---

### 1. Problem and Scale (15–20 Seconds)
> *"**Zlice** is a hyperlocal campus food delivery and real-time tracking platform built for IIT Kharagpur, connecting three core actors: students ordering food, campus canteens fulfilling orders, and student delivery partners on bicycles and e-bikes.*
> 
> *The system is designed for a campus scale of 15,000+ residents across 12 canteens, handling peak bursts of 1,000+ daily orders with sub-second live GPS tracking and sub-100ms API latency."*

---

### 2. High-Level Picture (30 Seconds)
> *"Architecturally, three client applications—a React Native app for students and delivery partners, and a React web dashboard for canteen kitchen staff—communicate with a **modular Node.js and TypeScript backend**.*
> 
> *The core services are organized into bounded domains: Multi-Role Auth, Catalog & Cart, Order Orchestration, Geospatial Dispatch, and Real-Time Tracking.*
> 
> *For persistence, I chose **MongoDB** with WiredTiger multi-document ACID transactions and 2dsphere spatial indexes, paired with **Redis** for in-memory hot-path location caching and token revocation, and **Socket.IO** for authenticated real-time live streaming."*

---

### 3. One Core Flow, End-to-End: Order Placement to Delivery (50–55 Seconds)
> *"Let’s trace a customer ordering two burgers and an iced coffee:*
> 
> 1. *The customer submits the order. The backend **never trusts client-sent prices**; it validates canteen operating hours, re-fetches authoritative item prices from MongoDB, applies 5% campus tax, and opens a **WiredTiger ACID transaction** that freezes immutable item price snapshots into the order document.*
> 2. *Payment is initiated with a client-generated **Idempotency Key**. When the gateway webhook fires, the backend validates the HMAC-SHA256 signature, ensures deduplication via an event log, and confirms the order.*
> 3. *The Canteen kitchen receives an instant WebSocket ticket and marks the food as preparing. This triggers the **Dispatch Engine**, which runs a `$near` geospatial query within a 3km radius, ranks available drivers using a multi-factor score (proximity, vehicle velocity, and acceptance rate), and locks the best candidate.*
> 4. *Once accepted, the driver collects the food and streams GPS pings every 3 seconds. The customer watches the live marker move on a map via WebSockets.*
> 5. *Finally, at the student dorm, the driver cannot mark the order delivered until they enter the secret **6-digit cryptographic OTP** shown exclusively on the customer’s screen."*

---

### 4. Key Design Decisions and Why (35 Seconds)

#### Decision A: Dual-Tier Tracking Pipeline (Hot-Path vs. Cold-Path)
> *"**Choice**: I built a dual-tier storage architecture for live tracking instead of writing every 3-second GPS ping directly to MongoDB.*
> 
> ***Alternative considered**: Writing every location update directly to MongoDB.*
> 
> ***Reason**: 500 active drivers sending GPS every 3 seconds generates ~167 writes/second. Writing that to disk causes catastrophic 2dsphere index dirty-page thrashing and disk I/O stalls.*
> 
> ***Trade-off**: High-frequency updates go straight to Redis and Socket.IO in sub-milliseconds, while MongoDB is throttled to flush only when the driver moves >40 meters or 45 seconds elapse. The trade-off is that in-flight breadcrumbs have eventual persistence, but disk I/O was slashed by 80%."*

#### Decision B: Refresh Token Rotation with Lineage Tracking (RFC 6819)
> *"**Choice**: Single-use Refresh Token Rotation with token family UUIDs over static refresh tokens.*
> 
> ***Alternative considered**: Storing one static long-lived refresh token in the database.*
> 
> ***Reason**: If a student's refresh token is intercepted over public campus Wi-Fi, a stolen static token grants infinite access. With rotation, the moment an attacker replays an old token, the backend detects family reuse and immediately revokes all sessions across all devices.*
> 
> ***Trade-off**: I had to build a 30-second leeway grace period to prevent mobile network jitter from falsely triggering replay alarms on concurrent requests."*

---

### 5. Hard Problem and How I Solved It (25 Seconds)
> *"The hardest challenge was the **Concurrent Double-Assignment Race Condition**:*
> 
> *If two students place orders at the exact same millisecond at adjacent canteens, two asynchronous dispatch workers both identify Driver A as the nearest available candidate. A naive read-then-write would assign Driver A to two conflicting orders.*
> 
> *I solved this using **Atomic Compare-And-Swap (CAS) Reservation Locks** in MongoDB. The worker executes `findOneAndUpdate` with a strict predicate requiring `activeOrderId: null` and `activeAssignmentId: null`, reserving the driver for a 30-second window. The losing worker instantly receives `null` at the database engine lock level and gracefully falls back to Candidate B without dropping the order."*

---

### 6. Limitations and What I’d Change at 100x Scale (20 Seconds)
> *"At 100x scale—say, 100,000 orders across multiple university cities:*
> 
> 1. *MongoDB’s `$near` spatial queries would choke on CPU. I would migrate spatial indexing to **Uber H3 hexagonal spatial indexing** stored in Redis memory, turning radius queries into $O(1)$ set lookups.*
> 2. *The in-process dispatch worker would be decoupled into a distributed event queue using **Kafka or BullMQ on Redis Streams** with dedicated dispatch workers.*
> 3. *I would decompose the modular monolith into dedicated microservices—Catalog, Dispatch, Billing, and Tracking—communicating over **gRPC**."*

---

### 7. Stop and Invite Questions (10 Seconds)
> *"That’s the high-level architecture of Zlice. I’m happy to dive deeper into the **atomic dispatch concurrency**, the **dual-tier WebSocket tracking pipeline**, or the **idempotent webhook financial engine**—whichever you’d prefer to explore!"*

---

## 🎯 Quick Cheat Sheet: The Golden Formula

```
"It's a [hyperlocal food delivery platform] for [15,000+ campus students, 12 canteens, and 50+ drivers] at [1,000+ daily orders].

The main components are [three React/React Native clients, an Express/TypeScript modular monolith, MongoDB, Redis, and Socket.IO].

When a user places an order, the request flows from [client] to [server-authoritative price engine] to [WiredTiger ACID transaction] to [HMAC webhook settlement] to [atomic geospatial dispatch] to [real-time live tracking].

The key decisions were:
1. Dual-tier Redis/MongoDB tracking to eliminate 80% of disk I/O and spatial index thrashing.
2. Refresh token rotation with reuse detection to stop stolen Wi-Fi tokens.

The hardest problem was [concurrent double-assignment], which I solved using [atomic CAS reservation locks with 30s TTL leeway].

If I rebuilt it for 100x scale, I'd [replace MongoDB spatial queries with Uber H3 in-memory hexagons and move dispatch onto Kafka]."
```
