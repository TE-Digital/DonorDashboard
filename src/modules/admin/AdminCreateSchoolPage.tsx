// src/modules/admin/AdminCreateSchoolPage.tsx
//
// Add school: one form, one save.
//
// This used to be a four-step wizard that also imported teachers and students
// by CSV. Rosters are now built from the school's own page, where the school
// already exists and both drawers can pre-fill it — so this screen does one
// thing and then hands over to that page, which confirms the creation.
//
// The fields live in SchoolForm, shared with the drawer version.

import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormPage } from "../../design-system";
import { SchoolForm } from "./SchoolForm";
import type { EntityFormHandle } from "./entityForm";

export const AdminCreateSchoolPage: React.FC = () => {
  const navigate = useNavigate();
  const form = useRef<EntityFormHandle>(null);
  const [, setSaving] = useState(false);

  return (
    <FormPage
      title="Add school"
      subtitle="Record the school. Teachers and students are added from the school's page once it exists."
    >
      <SchoolForm
        ref={form}
        showActions
        submitLabel="Create school"
        onSavingChange={setSaving}
        onCancel={() => navigate("/admin/schools")}
        onCreated={(school) => navigate(`/admin/schools/${school.id}?created=1`)}
      />
    </FormPage>
  );
};

export default AdminCreateSchoolPage;
