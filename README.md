# 🍕 Zlice — Hyperlocal Campus Food Delivery & Real-Time Tracking Platform

A production-grade, multi-sided campus food delivery platform connecting **Customers**, **Canteens**, and **Delivery Partners** through unified web and mobile applications, powered by an enterprise Node.js/TypeScript backend with MongoDB and Redis.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["Multi-Interface Applications"]
        CustomerApp["📱 Customer Mobile App\n(React Native)"]
        CanteenWeb["💻 Canteen Web/App\n(React / React Native)"]
        DeliveryApp["🛵 Delivery Partner App\n(React Native)"]
        AdminPortal["🛡️ Admin Web Dashboard\n(React)"]
    end

    subgraph Gateway["API & Security Layer"]
        RateLimiter["Rate Limiting & DDOS Guard"]
        AuthMiddleware["JWT & Session Authenticator"]
        RBAC["RBAC & Permission Matrix"]
        TenantIsolation["Multi-Tenant Canteen Scoper"]
    end

    subgraph Backend["Core Domain Services (Node.js & TypeScript)"]
        AuthService["Auth & Session Service\n(Token Rotation & Reuse Detection)"]
        CatalogService["Menu & Catalog Engine\n(Module 2)"]
        OrderService["Cart & Order Orchestration\n(Module 2)"]
        DispatchService["Real-Time Partner Assignment\n(Module 3)"]
        TrackingService["Live Location & WebSockets\n(Module 4)"]
        PaymentService["Transactions & Webhooks\n(Module 6)"]
    end

    subgraph Data["Persistence & Caching Tier"]
        MongoDB[("MongoDB ReplicaSet\n(Multi-Document ACID Transactions\n& 2dsphere Geospatial)")]
        Redis[("Redis Cluster\n(Token Revocation, Geo-Location\n& Real-Time State)")]
    end

    CustomerApp --> Gateway
    CanteenWeb --> Gateway
    DeliveryApp --> Gateway
    AdminPortal --> Gateway

    Gateway --> Backend
    Backend --> MongoDB
    Backend --> Redis
```

---

## 🚀 Modules Roadmap

- [x] **Module 1: Multi-Role Authentication, RBAC, Multi-Device Sessions & Multi-Tenant Data Isolation**
- [x] **Module 2: Food Catalog, Cart & High-Integrity Order Management**
- [x] **Module 3: Real-Time Geospatial Delivery Partner Assignment Engine**
- [x] **Module 4: Real-Time Live Tracking (WebSockets + Redis PubSub + Geo Stream)**
- [x] **Module 5: Multi-Interface Unified Contract Architecture (Customer, Canteen, Delivery, Admin)**
- [x] **Module 6: Enterprise Payments, Idempotent Webhooks & Transaction Reconciliation**

---

## 🧪 Module 1 Verification

Run the verification test suite:
```bash
cd backend
pnpm exec tsx scripts/verify-auth-flow.ts
```
