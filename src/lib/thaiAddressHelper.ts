// src/lib/thaiAddressHelper.ts
import { getAllData } from "thai-data";

export interface ThaiAddressItem {
  subdistrict: string;
  district: string;
  provinceThai: string;
  provinceEng: string;
  zipcode: string;
  label: string;
}

export const THAI_TO_ENG_PROVINCES: Record<string, string> = {
  "กรุงเทพมหานคร": "Bangkok",
  "กระบี่": "Krabi",
  "กาญจนบุรี": "Kanchanaburi",
  "กาฬสินธุ์": "Kalasin",
  "กำแพงเพชร": "Kamphaeng Phet",
  "ขอนแก่น": "Khon Kaen",
  "จันทบุรี": "Chanthaburi",
  "ฉะเชิงเทรา": "Chachoengsao",
  "ชลบุรี": "Chon Buri",
  "ชัยนาท": "Chai Nat",
  "ชัยภูมิ": "Chaiyaphum",
  "ชุมพร": "Chumphon",
  "เชียงราย": "Chiang Rai",
  "เชียงใหม่": "Chiang Mai",
  "ตรัง": "Trang",
  "ตราด": "Trat",
  "ตาก": "Tak",
  "นครนายก": "Nakhon Nayok",
  "นครปฐม": "Nakhon Pathom",
  "นครพนม": "Nakhon Phanom",
  "นครราชสีมา": "Nakhon Ratchasima",
  "นครศรีธรรมราช": "Nakhon Si Thammarat",
  "นครสวรรค์": "Nakhon Sawan",
  "นนทบุรี": "Nonthaburi",
  "นราธิวาส": "Narathiwat",
  "น่าน": "Nan",
  "บึงกาฬ": "Bueng Kan",
  "บุรีรัมย์": "Buri Ram",
  "ปทุมธานี": "Pathum Thani",
  "ประจวบคีรีขันธ์": "Prachuap Khiri Khan",
  "ปราจีนบุรี": "Prachin Buri",
  "ปัตตานี": "Pattani",
  "พระนครศรีอยุธยา": "Phra Nakhon Si Ayutthaya",
  "พังงา": "Phang Nga",
  "พัทลุง": "Phatthalung",
  "พิจิตร": "Phichit",
  "พิษณุโลก": "Phitsanulok",
  "เพชรบุรี": "Phetchaburi",
  "เพชรบูรณ์": "Phetchabun",
  "แพร่": "Phrae",
  "พะเยา": "Phayao",
  "ภูเก็ต": "Phuket",
  "มหาสารคาม": "Maha Sarakham",
  "มุกดาหาร": "Mukdahan",
  "แม่ฮ่องสอน": "Mae Hong Son",
  "ยโสธร": "Yasothon",
  "ยะลา": "Yala",
  "ร้อยเอ็ด": "Roi Et",
  "ระนอง": "Ranong",
  "ระยอง": "Rayong",
  "ราชบุรี": "Ratchaburi",
  "ลพบุรี": "Lop Buri",
  "ลำปาง": "Lampang",
  "ลำพูน": "Lamphun",
  "เลย": "Loei",
  "ศรีสะเกษ": "Si Sa Ket",
  "สกลนคร": "Sakon Nakhon",
  "สงขลา": "Songkhla",
  "สตูล": "Satun",
  "สมุทรปราการ": "Samut Prakan",
  "สมุทรสงคราม": "Samut Songkhram",
  "สมุทรสาคร": "Samut Sakhon",
  "สระแก้ว": "Sa Kaeo",
  "สระบุรี": "Saraburi",
  "สิงห์บุรี": "Sing Buri",
  "สุโขทัย": "Sukhothai",
  "สุพรรณบุรี": "Suphan Buri",
  "สุราษฎร์ธานี": "Surat Thani",
  "สุรินทร์": "Surin",
  "หนองคาย": "Nong Khai",
  "หนองบัวลำภู": "Nong Bua Lam Phu",
  "อ่างทอง": "Ang Thong",
  "อุดรธานี": "Udon Thani",
  "อุทัยธานี": "Uthai Thani",
  "อุตรดิตถ์": "Uttaradit",
  "อุบลราชธานี": "Ubon Ratchathani",
  "อำนาจเจริญ": "Amnat Charoen",
};

export const ENG_TO_THAI_PROVINCES: Record<string, string> = Object.entries(
  THAI_TO_ENG_PROVINCES
).reduce((acc, [th, en]) => {
  acc[en] = th;
  return acc;
}, {} as Record<string, string>);

let fullAddressCache: ThaiAddressItem[] | null = null;

function getFullAddressDataset(): ThaiAddressItem[] {
  if (fullAddressCache) return fullAddressCache;

  const items: ThaiAddressItem[] = [];
  const seenLabels = new Set<string>();

  try {
    const rawData = getAllData();
    if (Array.isArray(rawData)) {
      for (const zipData of rawData) {
        if (!zipData || !Array.isArray(zipData.subDistrictList) || !Array.isArray(zipData.provinceList) || !Array.isArray(zipData.districtList)) {
          continue;
        }

        const zipcode = String(zipData.zipCode || "");
        const provinceThai = zipData.provinceList[0]?.provinceName || "";
        const districtThai = zipData.districtList[0]?.districtName || "";
        const provinceEng = THAI_TO_ENG_PROVINCES[provinceThai] || provinceThai;

        for (const sub of zipData.subDistrictList) {
          if (!sub || !sub.subDistrictName) continue;
          const subdistrict = sub.subDistrictName;
          const label = `จ.${provinceThai} (${provinceEng}) » อ.${districtThai} » ต.${subdistrict} - ${zipcode}`;
          if (!seenLabels.has(label)) {
            seenLabels.add(label);
            items.push({
              subdistrict,
              district: districtThai,
              provinceThai,
              provinceEng,
              zipcode,
              label,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Error loading thai-data:", e);
  }

  fullAddressCache = items;
  return items;
}

/**
 * Searches Thailand address dataset dynamically using thai-data library.
 * Covers all 7,436 subdistricts, 928 districts, and 77 provinces across Thailand without hardcoded array lists.
 */
export function searchThailandAddress(query: string): ThaiAddressItem[] {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  const dataset = getFullAddressDataset();
  const results: ThaiAddressItem[] = [];

  for (const item of dataset) {
    const matchText = `${item.subdistrict} ${item.district} ${item.provinceThai} ${item.provinceEng} ${item.zipcode}`.toLowerCase();

    if (matchText.includes(cleanQuery)) {
      results.push(item);
      if (results.length >= 25) break;
    }
  }

  return results;
}
