// src/components/ThailandAddressAutocomplete.tsx
import React, { useState } from "react";
import {
  Autocomplete,
  Box,
  Text,
  Badge,
  Group,
  Paper,
  ActionIcon,
  Collapse,
} from "@mantine/core";
import { searchThailandAddress, ThaiAddressItem } from "../lib/thaiAddressHelper";
import { IconSearch, IconMapPin, IconCheck, IconX, IconSparkles } from "@tabler/icons-react";

interface ThailandAddressAutocompleteProps {
  onSelectAddress: (item: ThaiAddressItem) => void;
  placeholder?: string;
  label?: string;
}

export const ThailandAddressAutocomplete: React.FC<ThailandAddressAutocompleteProps> = ({
  onSelectAddress,
  placeholder = "พิมพ์ชื่อ ตำบล, อำเภอ หรือ รหัสไปรษณีย์...",
  label = "ค้นหาที่อยู่อัตโนมัติ",
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<ThaiAddressItem[]>([]);
  const [selectedSuccess, setSelectedSuccess] = useState<ThaiAddressItem | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (selectedSuccess) setSelectedSuccess(null);

    if (value.trim().length >= 2) {
      const matches = searchThailandAddress(value);
      setSearchResults(matches);
    } else {
      setSearchResults([]);
    }
  };

  const handleOptionSubmit = (val: string) => {
    const selected = searchResults.find((r) => r.label === val);
    if (selected) {
      onSelectAddress(selected);
      setSelectedSuccess(selected);
      setSearchValue(`จ.${selected.provinceThai} (${selected.provinceEng}) อ.${selected.district} ต.${selected.subdistrict} (${selected.zipcode})`);
      setSearchResults([]);
    }
  };

  const handleClear = () => {
    setSearchValue("");
    setSearchResults([]);
    setSelectedSuccess(null);
  };

  return (
    <Paper
      p="md"
      radius="md"
      mb="lg"
      style={{
        backgroundColor: "var(--mantine-color-blue-0, #eff6ff)",
        border: "1px solid var(--mantine-color-blue-2, #bfdbfe)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <Group justify="space-between" align="center" mb="xs">
        <Group gap="xs">
          <Badge
            variant="gradient"
            gradient={{ from: "blue", to: "indigo", deg: 45 }}
            leftSection={<IconSparkles size={12} />}
            size="sm"
            radius="sm"
          >
            Smart Auto-Fill
          </Badge>
          <Text fw={600} size="sm" c="blue.9">
            {label}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          กรอกข้อมูลอำเภอ/ตำบลอัตโนมัติ
        </Text>
      </Group>

      <Autocomplete
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
          }
        }}
        leftSection={<IconSearch size={16} style={{ color: "#3b82f6" }} />}
        leftSectionPointerEvents="none"
        leftSectionWidth={38}
        rightSection={
          searchValue ? (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleClear}
              title="ล้างคำค้นหา"
            >
              <IconX size={14} />
            </ActionIcon>
          ) : (
            <IconMapPin size={16} style={{ color: "#94a3b8" }} />
          )
        }
        data={searchResults.map((r) => r.label)}
        value={searchValue}
        onChange={handleSearchChange}
        onOptionSubmit={handleOptionSubmit}
        maxDropdownHeight={260}
        styles={{
          input: {
            height: 42,
            paddingLeft: 40,
            paddingRight: 36,
            borderRadius: 8,
            borderColor: "#cbd5e1",
            backgroundColor: "#ffffff",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1e293b",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            transition: "all 0.15s ease",
          },
        }}
      />

      <Collapse in={Boolean(selectedSuccess)}>
        {selectedSuccess && (
          <Group gap="xs" mt="xs">
            <Badge color="green" variant="light" leftSection={<IconCheck size={12} />} size="md">
              ดึงข้อมูลสำเร็จ: จ.{selectedSuccess.provinceThai} ({selectedSuccess.provinceEng}) อ.{selectedSuccess.district} ต.{selectedSuccess.subdistrict} {selectedSuccess.zipcode}
            </Badge>
          </Group>
        )}
      </Collapse>
    </Paper>
  );
};
