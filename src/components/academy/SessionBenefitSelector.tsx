import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BENEFIT_TYPE_OPTIONS,
  createDefaultBenefit,
  type BenefitType,
  type SessionBenefitInput,
} from "@/lib/academySession";
import { cn } from "@/lib/utils";

interface SessionBenefitSelectorProps {
  benefits: SessionBenefitInput[];
  onChange: (benefits: SessionBenefitInput[]) => void;
  validDays: string;
  onValidDaysChange: (value: string) => void;
  usageCondition: string;
  onUsageConditionChange: (value: string) => void;
  errors: Record<string, string>;
}

const SessionBenefitSelector = ({
  benefits,
  onChange,
  validDays,
  onValidDaysChange,
  usageCondition,
  onUsageConditionChange,
  errors,
}: SessionBenefitSelectorProps) => {
  const selectedTypes = new Set(benefits.map((benefit) => benefit.benefitType));
  const customBenefit = benefits.find((benefit) => benefit.benefitType === "custom");

  const toggleBenefitType = (type: BenefitType) => {
    if (selectedTypes.has(type)) {
      onChange(benefits.filter((benefit) => benefit.benefitType !== type));
      return;
    }

    onChange([...benefits, createDefaultBenefit(type)]);
  };

  const updateCustomBenefit = (field: "benefitLabel" | "discountValue", value: string) => {
    if (!customBenefit) return;

    onChange(
      benefits.map((benefit) =>
        benefit.benefitType === "custom" ? { ...benefit, [field]: value } : benefit,
      ),
    );
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">발급할 혜택</h2>
        <p className="text-xs text-muted-foreground">복수 선택 가능 · 학부모에게 혜택별 쿠폰이 발급됩니다</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {BENEFIT_TYPE_OPTIONS.map((option) => {
          const selected = selectedTypes.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleBenefitType(option.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {errors.benefits && <p className="text-xs text-destructive">{errors.benefits}</p>}

      {benefits.length > 0 && (
        <div className="space-y-2">
          <Label>선택된 혜택 ({benefits.length}개)</Label>
          <div className="space-y-2">
            {benefits.map((benefit) => (
              <div
                key={benefit.benefitType}
                className="bg-card border border-border rounded-xl px-3 py-2 text-sm flex items-center justify-between gap-3"
              >
                <span className="font-medium text-foreground">{benefit.benefitLabel || "직접입력"}</span>
                <span className="text-primary font-semibold shrink-0">{benefit.discountValue || "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {customBenefit && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">직접입력 혜택</p>
          <div className="space-y-2">
            <Label htmlFor="customBenefitLabel">혜택명</Label>
            <Input
              id="customBenefitLabel"
              value={customBenefit.benefitLabel}
              onChange={(e) => updateCustomBenefit("benefitLabel", e.target.value)}
              placeholder="예: 재등록 할인"
            />
            {errors.customBenefitLabel && (
              <p className="text-xs text-destructive">{errors.customBenefitLabel}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customDiscountValue">할인값</Label>
            <Input
              id="customDiscountValue"
              value={customBenefit.discountValue}
              onChange={(e) => updateCustomBenefit("discountValue", e.target.value)}
              placeholder="10% / 50,000원 / 1회"
            />
            {errors.customDiscountValue && (
              <p className="text-xs text-destructive">{errors.customDiscountValue}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="validDays">유효기간 (일)</Label>
        <Input
          id="validDays"
          type="number"
          min={7}
          max={90}
          value={validDays}
          onChange={(e) => onValidDaysChange(e.target.value)}
        />
        {errors.validDays && <p className="text-xs text-destructive">{errors.validDays}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="usageCondition">사용 조건</Label>
        <Textarea
          id="usageCondition"
          value={usageCondition}
          onChange={(e) => onUsageConditionChange(e.target.value)}
          placeholder="학원 등록 시 사용 가능"
          rows={2}
          maxLength={120}
        />
      </div>
    </section>
  );
};

export default SessionBenefitSelector;
