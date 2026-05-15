-- user_vehicle_access supports scoped human access using internal vehicle IDs.
CREATE TABLE public.user_vehicle_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles("vehicleId") ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('assigned_driver', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, vehicle_id)
);

-- A driver can only have one assigned vehicle row.
CREATE UNIQUE INDEX user_vehicle_access_one_driver_vehicle_per_user_idx
  ON public.user_vehicle_access (user_id)
  WHERE access_level = 'assigned_driver';

-- A vehicle can only have one assigned driver row.
CREATE UNIQUE INDEX user_vehicle_access_one_driver_per_vehicle_idx
  ON public.user_vehicle_access (vehicle_id)
  WHERE access_level = 'assigned_driver';

CREATE INDEX user_vehicle_access_user_id_idx
  ON public.user_vehicle_access (user_id);

CREATE INDEX user_vehicle_access_vehicle_id_idx
  ON public.user_vehicle_access (vehicle_id);

ALTER TABLE public.user_vehicle_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vehicle access"
  ON public.user_vehicle_access FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all vehicle access"
  ON public.user_vehicle_access FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- device_credentials supports separate machine auth and direct device -> vehicle binding.
CREATE TABLE public.device_credentials (
  device_id TEXT PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles("vehicleId") ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX device_credentials_vehicle_id_idx
  ON public.device_credentials (vehicle_id);

ALTER TABLE public.device_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage device credentials"
  ON public.device_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
