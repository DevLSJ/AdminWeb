package com.ineb.dguard_kms.domain.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_chain_head")
public class AuditChainHead {

    @Id
    private Short id;

    @Column(name = "current_hash", length = 128)
    private String currentHash;

    protected AuditChainHead() {
    }

    public AuditChainHead(short id) {
        this.id = id;
    }

    public String getCurrentHash() {
        return currentHash;
    }

    public void advance(String currentHash) {
        this.currentHash = currentHash;
    }
}
