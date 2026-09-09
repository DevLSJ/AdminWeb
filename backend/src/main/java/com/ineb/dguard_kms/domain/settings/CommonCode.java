package com.ineb.dguard_kms.domain.settings;

import jakarta.persistence.*;

@Entity
@Table(name = "common_code", uniqueConstraints = @UniqueConstraint(columnNames = {"code_group", "code"}))
public class CommonCode {
    @Id @Column(length = 80) private String id;
    @Column(name = "code_group", nullable = false, length = 20) private String group;
    @Column(nullable = false, length = 32) private String code;
    @Column(nullable = false, length = 80) private String label;
    @Column(nullable = false, length = 200) private String description;
    @Column(nullable = false) private int sortOrder;
    @Column(nullable = false) private boolean enabled;
    @Version private long version;
    protected CommonCode() { }
    public CommonCode(String group, String code, String label, String description, int sortOrder, boolean enabled) {
        this.id = group + ":" + code; this.group = group; this.code = code; this.label = label;
        this.description = description; this.sortOrder = sortOrder; this.enabled = enabled;
    }
    public void update(String label, String description, int sortOrder, boolean enabled) {
        this.label = label.trim(); this.description = description.trim(); this.sortOrder = sortOrder; this.enabled = enabled;
    }
    public String getGroup() { return group; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public String getDescription() { return description; }
    public int getSortOrder() { return sortOrder; }
    public boolean isEnabled() { return enabled; }
    public long getVersion() { return version; }
}
