--
-- PostgreSQL database dump
--

\restrict Fks17OWiGsNWAnF4S0p6UJNg8Bw0xVcHmGTkhxaDrKejevIFu4QTKdjM2J3xcnP

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: business_modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_modules (
    id integer NOT NULL,
    business_id integer NOT NULL,
    module text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.business_modules OWNER TO postgres;

--
-- Name: business_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_modules_id_seq OWNER TO postgres;

--
-- Name: business_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_modules_id_seq OWNED BY public.business_modules.id;


--
-- Name: business_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_users (
    id integer NOT NULL,
    business_id integer NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'cashier'::text NOT NULL,
    location_id integer,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.business_users OWNER TO postgres;

--
-- Name: business_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.business_users_id_seq OWNER TO postgres;

--
-- Name: business_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_users_id_seq OWNED BY public.business_users.id;


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.businesses (
    id integer NOT NULL,
    name text NOT NULL,
    owner_user_id text NOT NULL,
    industry text DEFAULT 'restaurant'::text,
    logo_url text,
    phone text,
    email text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.businesses OWNER TO postgres;

--
-- Name: businesses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.businesses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.businesses_id_seq OWNER TO postgres;

--
-- Name: businesses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.businesses_id_seq OWNED BY public.businesses.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name text NOT NULL,
    parent_id integer,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: custom_field_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_field_values (
    id integer NOT NULL,
    field_id integer NOT NULL,
    entity_id integer NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.custom_field_values OWNER TO postgres;

--
-- Name: custom_field_values_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.custom_field_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.custom_field_values_id_seq OWNER TO postgres;

--
-- Name: custom_field_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.custom_field_values_id_seq OWNED BY public.custom_field_values.id;


--
-- Name: custom_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_fields (
    id integer NOT NULL,
    business_id integer NOT NULL,
    entity_type text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    options jsonb,
    sort_order integer DEFAULT 0,
    required boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.custom_fields OWNER TO postgres;

--
-- Name: custom_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.custom_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.custom_fields_id_seq OWNER TO postgres;

--
-- Name: custom_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.custom_fields_id_seq OWNED BY public.custom_fields.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: employee_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_roles (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employee_roles OWNER TO postgres;

--
-- Name: employee_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_roles_id_seq OWNER TO postgres;

--
-- Name: employee_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_roles_id_seq OWNED BY public.employee_roles.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    role_id integer,
    location_id integer,
    hourly_rate numeric(10,2),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_id_seq OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    location_id integer NOT NULL,
    quantity numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    low_stock_threshold numeric(10,3) DEFAULT '10'::numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_id_seq OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_transactions (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    location_id integer NOT NULL,
    type text NOT NULL,
    quantity_change numeric(10,3) NOT NULL,
    reference_type text,
    reference_id integer,
    batch_id text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


ALTER TABLE public.inventory_transactions OWNER TO postgres;

--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_transactions_id_seq OWNER TO postgres;

--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_transactions_id_seq OWNED BY public.inventory_transactions.id;


--
-- Name: item_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_variants (
    id integer NOT NULL,
    item_id integer NOT NULL,
    name text NOT NULL,
    sku text,
    price numeric(10,2),
    cost numeric(10,2),
    attributes jsonb,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.item_variants OWNER TO postgres;

--
-- Name: item_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.item_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_variants_id_seq OWNER TO postgres;

--
-- Name: item_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_variants_id_seq OWNED BY public.item_variants.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'product'::text NOT NULL,
    category_id integer,
    base_price numeric(10,2),
    cost numeric(10,2),
    track_inventory boolean DEFAULT true NOT NULL,
    has_variants boolean DEFAULT false NOT NULL,
    image_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    business_id integer NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'restaurant'::text NOT NULL,
    address text,
    phone text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: order_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_lines (
    id integer NOT NULL,
    order_id integer NOT NULL,
    variant_id integer,
    name text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    price numeric(10,2) NOT NULL,
    notes text,
    modifiers jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_lines OWNER TO postgres;

--
-- Name: order_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_lines_id_seq OWNER TO postgres;

--
-- Name: order_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_lines_id_seq OWNED BY public.order_lines.id;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    from_status text,
    to_status text NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_status_history OWNER TO postgres;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_status_history_id_seq OWNER TO postgres;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    business_id integer NOT NULL,
    location_id integer NOT NULL,
    customer_id integer,
    order_type text DEFAULT 'dine_in'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    table_number text,
    notes text,
    subtotal numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    tax numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: recipe_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipe_items (
    id integer NOT NULL,
    recipe_id integer NOT NULL,
    ingredient_variant_id integer NOT NULL,
    quantity numeric(10,4) NOT NULL,
    unit text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recipe_items OWNER TO postgres;

--
-- Name: recipe_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipe_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipe_items_id_seq OWNER TO postgres;

--
-- Name: recipe_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipe_items_id_seq OWNED BY public.recipe_items.id;


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipes (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recipes OWNER TO postgres;

--
-- Name: recipes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recipes_id_seq OWNER TO postgres;

--
-- Name: recipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recipes_id_seq OWNED BY public.recipes.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    location_id integer NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shifts_id_seq OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_entries (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    location_id integer,
    clock_in timestamp with time zone NOT NULL,
    clock_out timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by text,
    rejection_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.time_entries OWNER TO postgres;

--
-- Name: time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.time_entries_id_seq OWNER TO postgres;

--
-- Name: time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.time_entries_id_seq OWNED BY public.time_entries.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    image_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: business_modules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_modules ALTER COLUMN id SET DEFAULT nextval('public.business_modules_id_seq'::regclass);


--
-- Name: business_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_users ALTER COLUMN id SET DEFAULT nextval('public.business_users_id_seq'::regclass);


--
-- Name: businesses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses ALTER COLUMN id SET DEFAULT nextval('public.businesses_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: custom_field_values id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values ALTER COLUMN id SET DEFAULT nextval('public.custom_field_values_id_seq'::regclass);


--
-- Name: custom_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields ALTER COLUMN id SET DEFAULT nextval('public.custom_fields_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: employee_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles ALTER COLUMN id SET DEFAULT nextval('public.employee_roles_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- Name: inventory_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions ALTER COLUMN id SET DEFAULT nextval('public.inventory_transactions_id_seq'::regclass);


--
-- Name: item_variants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_variants ALTER COLUMN id SET DEFAULT nextval('public.item_variants_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: order_lines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_lines ALTER COLUMN id SET DEFAULT nextval('public.order_lines_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: recipe_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_items ALTER COLUMN id SET DEFAULT nextval('public.recipe_items_id_seq'::regclass);


--
-- Name: recipes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes ALTER COLUMN id SET DEFAULT nextval('public.recipes_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: time_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries ALTER COLUMN id SET DEFAULT nextval('public.time_entries_id_seq'::regclass);


--
-- Data for Name: business_modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business_modules (id, business_id, module, enabled, created_at, updated_at) FROM stdin;
1	1	inventory	t	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
2	1	orders	t	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
3	1	employees	t	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
4	1	scheduling	f	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
5	1	time_tracking	f	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
6	1	reports	f	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
7	1	payroll_future	f	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
8	1	recipes_future	f	2026-04-28 19:58:59.681708+00	2026-04-28 19:58:59.681708+00
9	2	inventory	t	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
10	2	orders	t	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
11	2	employees	t	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
12	2	scheduling	f	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
13	2	time_tracking	f	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
14	2	reports	f	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
15	2	payroll_future	f	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
16	2	recipes_future	f	2026-04-28 20:01:47.83676+00	2026-04-28 20:01:47.83676+00
17	3	inventory	t	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
18	3	orders	t	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
19	3	employees	t	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
20	3	scheduling	f	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
21	3	time_tracking	f	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
22	3	reports	f	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
23	3	payroll_future	f	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
24	3	recipes_future	f	2026-04-28 20:03:55.377691+00	2026-04-28 20:03:55.377691+00
25	4	inventory	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
26	4	orders	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
27	4	employees	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
28	4	scheduling	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
29	4	time_tracking	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
30	4	reports	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
31	4	payroll_future	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
32	4	recipes_future	t	2026-04-28 20:13:19.326511+00	2026-04-28 20:13:19.326511+00
33	5	inventory	t	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.69+00
34	5	orders	t	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.69+00
37	5	time_tracking	f	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.703+00
36	5	scheduling	t	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.706+00
40	5	recipes_future	f	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.706+00
38	5	reports	f	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.707+00
39	5	payroll_future	f	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.708+00
35	5	employees	t	2026-04-28 20:15:06.694145+00	2026-04-28 20:15:21.708+00
41	6	inventory	t	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
42	6	orders	t	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
43	6	employees	t	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
44	6	scheduling	f	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
45	6	time_tracking	f	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
46	6	reports	f	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
47	6	payroll_future	f	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
48	6	recipes_future	f	2026-04-28 20:18:10.599831+00	2026-04-28 20:18:10.599831+00
49	7	inventory	t	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
50	7	orders	t	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
51	7	employees	t	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
52	7	scheduling	f	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
53	7	time_tracking	f	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
54	7	reports	f	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
55	7	payroll_future	f	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
56	7	recipes_future	f	2026-04-28 20:27:53.727543+00	2026-04-28 20:27:53.727543+00
57	8	inventory	t	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
58	8	orders	t	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
59	8	employees	t	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
60	8	scheduling	f	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
61	8	time_tracking	f	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
62	8	reports	f	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
63	8	payroll_future	f	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
64	8	recipes_future	f	2026-04-28 20:39:16.723327+00	2026-04-28 20:39:16.723327+00
65	9	inventory	t	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
66	9	orders	t	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
67	9	employees	t	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
68	9	scheduling	f	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
69	9	time_tracking	f	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
70	9	reports	f	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
71	9	payroll_future	f	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
72	9	recipes_future	f	2026-04-28 20:52:41.067028+00	2026-04-28 20:52:41.067028+00
73	10	inventory	t	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
74	10	orders	t	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
75	10	employees	t	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
76	10	scheduling	f	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
77	10	time_tracking	f	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
78	10	reports	f	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
79	10	payroll_future	f	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
80	10	recipes_future	f	2026-04-28 21:05:30.509175+00	2026-04-28 21:05:30.509175+00
81	11	inventory	t	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.485+00
84	11	scheduling	t	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.486+00
83	11	employees	t	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.486+00
86	11	reports	t	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.486+00
82	11	orders	t	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.486+00
87	11	payroll_future	f	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.487+00
85	11	time_tracking	t	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.487+00
88	11	recipes_future	f	2026-04-28 22:47:21.332796+00	2026-04-28 22:48:27.487+00
\.


--
-- Data for Name: business_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business_users (id, business_id, user_id, role, location_id, active, created_at, updated_at) FROM stdin;
1	4	seed_manager_user_demo_001	manager	4	t	2026-04-28 20:13:19.35961+00	2026-04-28 20:13:19.35961+00
2	4	seed_cashier_user_demo_001	cashier	4	t	2026-04-28 20:13:19.35961+00	2026-04-28 20:13:19.35961+00
3	4	seed_hr_user_demo_001	hr	\N	t	2026-04-28 20:13:19.35961+00	2026-04-28 20:13:19.35961+00
\.


--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.businesses (id, name, owner_user_id, industry, logo_url, phone, email, address, created_at, updated_at) FROM stdin;
1	Jane's Bistro	user_3D05mQdSBzEfTOswy7MFUaJ2IaF	restaurant	\N	\N	\N	\N	2026-04-28 19:58:59.647476+00	2026-04-28 19:58:59.647476+00
2	Jane's Bistro	user_3D065o7mdq0Mv7vODXJ2zlhXuar	restaurant	\N	\N	\N	\N	2026-04-28 20:01:47.808453+00	2026-04-28 20:01:47.808453+00
3	Alice's Cafe	user_3D06LRx8IEnZn8WK26Urwkn5DyG	restaurant	\N	\N	\N	\N	2026-04-28 20:03:55.344554+00	2026-04-28 20:03:55.344554+00
4	BizCore Demo Bistro	seed_owner_user_demo_001	restaurant	\N	+1 (555) 000-0001	demo@bizcore.io	123 Main Street, San Francisco, CA 94105	2026-04-28 20:13:19.276308+00	2026-04-28 20:13:19.276308+00
5	Bob's Grill	user_3D07gX5x1KjnhaswmKMzk5PQ2tY	restaurant	\N	\N	\N	\N	2026-04-28 20:15:06.686132+00	2026-04-28 20:15:06.686132+00
6	Carol's Kitchen	user_3D086YKYJkKXttYW7sIlUhOXuGm	restaurant	\N	\N	\N	\N	2026-04-28 20:18:10.507744+00	2026-04-28 20:18:10.507744+00
7	David's Diner	user_3D09HNc2FzwQRg0RTEPCGeTz0Sy	restaurant	\N	\N	\N	\N	2026-04-28 20:27:53.688666+00	2026-04-28 20:27:53.688666+00
8	Team Test Diner	user_3D0AUDeFjOCHF8ZqaG7jUR16VEp	restaurant	\N	\N	\N	\N	2026-04-28 20:39:16.693455+00	2026-04-28 20:39:16.693455+00
9	Security Test Corp	user_3D0CIBH6mdgeVgW1d575ErGZZ1h	restaurant	\N	\N	\N	\N	2026-04-28 20:52:41.059272+00	2026-04-28 20:52:41.059272+00
10	Member Test Inc	user_3D0DhDugTUNmNTlma0gRorPsd3I	restaurant	\N	\N	\N	\N	2026-04-28 21:05:30.501252+00	2026-04-28 21:05:30.501252+00
11	Acme Corp	user_3D0QE8IEcNC3HhffLM5H0kvqcKU	restaurant	\N				2026-04-28 22:47:21.323023+00	2026-04-28 22:53:05.738+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, business_id, name, parent_id, sort_order, active, created_at, updated_at) FROM stdin;
1	11	Burgers	\N	0	t	2026-04-28 22:50:41.764048+00	2026-04-28 22:50:41.764048+00
2	11	Drinks	\N	0	t	2026-04-28 22:50:51.33446+00	2026-04-28 22:50:51.33446+00
\.


--
-- Data for Name: custom_field_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_field_values (id, field_id, entity_id, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_fields (id, business_id, entity_type, name, type, options, sort_order, required, created_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, business_id, name, phone, email, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employee_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_roles (id, business_id, name, created_at) FROM stdin;
1	4	Server	2026-04-28 20:13:19.333204+00
2	4	Kitchen Staff	2026-04-28 20:13:19.33931+00
3	4	Manager	2026-04-28 20:13:19.344977+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employees (id, business_id, name, email, phone, role_id, location_id, hourly_rate, active, created_at, updated_at) FROM stdin;
1	4	Sarah Chen	sarah@bizcore-demo.io	+1 (555) 100-0001	3	4	25.00	t	2026-04-28 20:13:19.350778+00	2026-04-28 20:13:19.350778+00
2	4	Marcus Williams	marcus@bizcore-demo.io	+1 (555) 100-0002	1	4	16.50	t	2026-04-28 20:13:19.350778+00	2026-04-28 20:13:19.350778+00
3	4	Priya Patel	priya@bizcore-demo.io	+1 (555) 100-0003	2	4	18.00	t	2026-04-28 20:13:19.350778+00	2026-04-28 20:13:19.350778+00
4	4	Jordan Lee	jordan@bizcore-demo.io	+1 (555) 100-0004	1	5	16.50	t	2026-04-28 20:13:19.350778+00	2026-04-28 20:13:19.350778+00
5	4	Emily Torres	emily@bizcore-demo.io	+1 (555) 100-0005	2	5	18.00	f	2026-04-28 20:13:19.350778+00	2026-04-28 20:13:19.350778+00
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, variant_id, location_id, quantity, low_stock_threshold, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_transactions (id, variant_id, location_id, type, quantity_change, reference_type, reference_id, batch_id, notes, created_by, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: item_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_variants (id, item_id, name, sku, price, cost, attributes, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, business_id, name, description, type, category_id, base_price, cost, track_inventory, has_variants, image_url, active, created_at, updated_at) FROM stdin;
1	11	Cheese Burger	\N	menu_item	\N	12.95	4.25	t	t	\N	t	2026-04-28 22:50:26.912912+00	2026-04-28 22:50:26.912912+00
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.locations (id, business_id, name, type, address, phone, active, created_at, updated_at) FROM stdin;
1	1	Main Street	hq	\N	\N	t	2026-04-28 19:58:59.712846+00	2026-04-28 19:58:59.712846+00
2	2	Downtown	hq	\N	\N	t	2026-04-28 20:01:47.858843+00	2026-04-28 20:01:47.858843+00
3	3	Main Branch	hq	\N	\N	t	2026-04-28 20:03:55.400276+00	2026-04-28 20:03:55.400276+00
4	4	Downtown SF	restaurant	123 Main Street, San Francisco, CA 94105	+1 (555) 000-0002	t	2026-04-28 20:13:19.312645+00	2026-04-28 20:13:19.312645+00
5	4	Mission District	restaurant	456 Valencia Street, San Francisco, CA 94110	+1 (555) 000-0003	t	2026-04-28 20:13:19.320004+00	2026-04-28 20:13:19.320004+00
6	5	Central Branch	hq	\N	\N	t	2026-04-28 20:15:06.722853+00	2026-04-28 20:15:06.722853+00
7	6	Main Street	hq	\N	\N	t	2026-04-28 20:18:10.631938+00	2026-04-28 20:18:10.631938+00
8	7	Airport Branch	hq	\N	\N	t	2026-04-28 20:27:53.783493+00	2026-04-28 20:27:53.783493+00
9	8	Main Street	hq	\N	\N	t	2026-04-28 20:39:16.758287+00	2026-04-28 20:39:16.758287+00
10	9	Headquarters	hq	\N	\N	t	2026-04-28 20:52:41.089909+00	2026-04-28 20:52:41.089909+00
11	9	Branch Office	restaurant			t	2026-04-28 20:53:27.934797+00	2026-04-28 20:53:27.934797+00
12	10	HQ	hq	\N	\N	t	2026-04-28 21:05:30.53513+00	2026-04-28 21:05:30.53513+00
13	11	Main Location	hq			t	2026-04-28 22:47:21.41793+00	2026-04-28 22:47:54.35+00
\.


--
-- Data for Name: order_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_lines (id, order_id, variant_id, name, quantity, price, notes, modifiers, created_at) FROM stdin;
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_status_history (id, order_id, from_status, to_status, changed_by, changed_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, business_id, location_id, customer_id, order_type, status, table_number, notes, subtotal, discount, tax, total, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recipe_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipe_items (id, recipe_id, ingredient_variant_id, quantity, unit, created_at) FROM stdin;
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipes (id, menu_item_id, name, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, employee_id, location_id, start_time, end_time, notes, created_at) FROM stdin;
\.


--
-- Data for Name: time_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.time_entries (id, employee_id, location_id, clock_in, clock_out, status, approved_by, rejection_reason, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, first_name, last_name, image_url, active, created_at, updated_at) FROM stdin;
user_3D0CIBH6mdgeVgW1d575ErGZZ1h	testuser_utcbmz@example.com	Security	Tester	https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zRDA0VUJqNG5nQzJaSVNDOVJ3SXNiVVlzejUiLCJyaWQiOiJ1c2VyXzNEMENJQkg2bWRnZVZnVzFkNTc1RXJHWloxaCIsImluaXRpYWxzIjoiU1QifQ	t	2026-04-28 20:51:58.803862+00	2026-04-28 20:51:58.803862+00
user_3D0DhDugTUNmNTlma0gRorPsd3I	membertest_f-jrfn@example.com	Member	Test	https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zRDA0VUJqNG5nQzJaSVNDOVJ3SXNiVVlzejUiLCJyaWQiOiJ1c2VyXzNEMERoRHVnVFVObU5UbG1hMGdSb3JQc2QzSSIsImluaXRpYWxzIjoiTVQifQ	t	2026-04-28 21:03:32.237423+00	2026-04-28 21:07:59.673+00
user_3D0QE8IEcNC3HhffLM5H0kvqcKU	ikamand@gmail.com	\N	\N	https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18zRDA0VUJqNG5nQzJaSVNDOVJ3SXNiVVlzejUiLCJyaWQiOiJ1c2VyXzNEMFFFOElFY05DM0hoZmZMTTVIMGt2cWNLVSJ9	t	2026-04-28 22:46:34.14924+00	2026-04-29 01:05:27.15+00
\.


--
-- Name: business_modules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.business_modules_id_seq', 88, true);


--
-- Name: business_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.business_users_id_seq', 3, true);


--
-- Name: businesses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.businesses_id_seq', 11, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 2, true);


--
-- Name: custom_field_values_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.custom_field_values_id_seq', 1, false);


--
-- Name: custom_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.custom_fields_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 1, false);


--
-- Name: employee_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_roles_id_seq', 3, true);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employees_id_seq', 5, true);


--
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_id_seq', 1, false);


--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_transactions_id_seq', 1, false);


--
-- Name: item_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_variants_id_seq', 1, false);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_seq', 1, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.locations_id_seq', 13, true);


--
-- Name: order_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_lines_id_seq', 1, false);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_status_history_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: recipe_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recipe_items_id_seq', 1, false);


--
-- Name: recipes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recipes_id_seq', 1, false);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shifts_id_seq', 1, false);


--
-- Name: time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.time_entries_id_seq', 1, false);


--
-- Name: business_modules business_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_modules
    ADD CONSTRAINT business_modules_pkey PRIMARY KEY (id);


--
-- Name: business_users business_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_users
    ADD CONSTRAINT business_users_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: custom_field_values custom_field_values_field_entity_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_field_entity_unique UNIQUE (field_id, entity_id);


--
-- Name: custom_field_values custom_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_pkey PRIMARY KEY (id);


--
-- Name: custom_fields custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: employee_roles employee_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_variant_location_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_variant_location_unique UNIQUE (variant_id, location_id);


--
-- Name: item_variants item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_variants
    ADD CONSTRAINT item_variants_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: order_lines order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: business_modules_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_modules_business_id_idx ON public.business_modules USING btree (business_id);


--
-- Name: business_users_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_users_business_id_idx ON public.business_users USING btree (business_id);


--
-- Name: business_users_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_users_location_id_idx ON public.business_users USING btree (location_id);


--
-- Name: business_users_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_users_user_id_idx ON public.business_users USING btree (user_id);


--
-- Name: businesses_owner_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX businesses_owner_user_id_idx ON public.businesses USING btree (owner_user_id);


--
-- Name: categories_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_business_id_idx ON public.categories USING btree (business_id);


--
-- Name: custom_field_values_field_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX custom_field_values_field_id_idx ON public.custom_field_values USING btree (field_id);


--
-- Name: custom_fields_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX custom_fields_business_id_idx ON public.custom_fields USING btree (business_id);


--
-- Name: customers_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX customers_business_id_idx ON public.customers USING btree (business_id);


--
-- Name: employee_roles_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employee_roles_business_id_idx ON public.employee_roles USING btree (business_id);


--
-- Name: employees_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employees_business_id_idx ON public.employees USING btree (business_id);


--
-- Name: employees_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employees_location_id_idx ON public.employees USING btree (location_id);


--
-- Name: inventory_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_location_id_idx ON public.inventory USING btree (location_id);


--
-- Name: inventory_transactions_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_transactions_location_id_idx ON public.inventory_transactions USING btree (location_id);


--
-- Name: inventory_transactions_variant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_transactions_variant_id_idx ON public.inventory_transactions USING btree (variant_id);


--
-- Name: inventory_variant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_variant_id_idx ON public.inventory USING btree (variant_id);


--
-- Name: item_variants_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX item_variants_item_id_idx ON public.item_variants USING btree (item_id);


--
-- Name: items_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX items_business_id_idx ON public.items USING btree (business_id);


--
-- Name: locations_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX locations_business_id_idx ON public.locations USING btree (business_id);


--
-- Name: order_lines_order_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_lines_order_id_idx ON public.order_lines USING btree (order_id);


--
-- Name: order_status_history_order_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_status_history_order_id_idx ON public.order_status_history USING btree (order_id);


--
-- Name: orders_business_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_business_id_created_at_idx ON public.orders USING btree (business_id, created_at);


--
-- Name: orders_business_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_business_id_idx ON public.orders USING btree (business_id);


--
-- Name: orders_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_location_id_idx ON public.orders USING btree (location_id);


--
-- Name: shifts_employee_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_employee_id_idx ON public.shifts USING btree (employee_id);


--
-- Name: shifts_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX shifts_location_id_idx ON public.shifts USING btree (location_id);


--
-- Name: time_entries_employee_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX time_entries_employee_id_idx ON public.time_entries USING btree (employee_id);


--
-- Name: time_entries_location_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX time_entries_location_id_idx ON public.time_entries USING btree (location_id);


--
-- Name: time_entries_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX time_entries_status_idx ON public.time_entries USING btree (status);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: business_modules business_modules_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_modules
    ADD CONSTRAINT business_modules_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_users business_users_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_users
    ADD CONSTRAINT business_users_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_users business_users_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_users
    ADD CONSTRAINT business_users_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: categories categories_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: custom_field_values custom_field_values_field_id_custom_fields_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_field_values
    ADD CONSTRAINT custom_field_values_field_id_custom_fields_id_fk FOREIGN KEY (field_id) REFERENCES public.custom_fields(id) ON DELETE CASCADE;


--
-- Name: custom_fields custom_fields_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_fields
    ADD CONSTRAINT custom_fields_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: customers customers_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employee_roles employee_roles_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_roles
    ADD CONSTRAINT employee_roles_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employees employees_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: employees employees_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: employees employees_role_id_employee_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_role_id_employee_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.employee_roles(id);


--
-- Name: inventory inventory_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: inventory_transactions inventory_transactions_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: inventory_transactions inventory_transactions_variant_id_item_variants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_variant_id_item_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.item_variants(id);


--
-- Name: inventory inventory_variant_id_item_variants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_variant_id_item_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.item_variants(id) ON DELETE CASCADE;


--
-- Name: item_variants item_variants_item_id_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_variants
    ADD CONSTRAINT item_variants_item_id_items_id_fk FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: items items_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: items items_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: locations locations_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_variant_id_item_variants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_variant_id_item_variants_id_fk FOREIGN KEY (variant_id) REFERENCES public.item_variants(id);


--
-- Name: order_status_history order_status_history_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_business_id_businesses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_business_id_businesses_id_fk FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: recipe_items recipe_items_ingredient_variant_id_item_variants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_ingredient_variant_id_item_variants_id_fk FOREIGN KEY (ingredient_variant_id) REFERENCES public.item_variants(id);


--
-- Name: recipe_items recipe_items_recipe_id_recipes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_recipe_id_recipes_id_fk FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_menu_item_id_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_menu_item_id_items_id_fk FOREIGN KEY (menu_item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: time_entries time_entries_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_location_id_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_location_id_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Fks17OWiGsNWAnF4S0p6UJNg8Bw0xVcHmGTkhxaDrKejevIFu4QTKdjM2J3xcnP

