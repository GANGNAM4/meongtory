package com.my.backend.contract.service;

import com.my.backend.contract.entity.ContractTemplate;
import com.my.backend.contract.entity.ContractSection;
import com.my.backend.contract.repository.ContractTemplateRepository;
import com.my.backend.contract.repository.ContractSectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractTemplateInitializationService implements CommandLineRunner {
    
    private final ContractTemplateRepository contractTemplateRepository;
    private final ContractSectionRepository contractSectionRepository;
    
    @Override
    public void run(String... args) throws Exception {
        initializeDefaultTemplates();
    }
    
    private void initializeDefaultTemplates() {
        // 이미 기본 템플릿이 있는지 확인
        if (contractTemplateRepository.count() > 0) {
            return;
        }
        
        log.info("기본 계약서 템플릿을 생성합니다.");
        
        // 입양계약서 템플릿
        ContractTemplate adoptionTemplate = ContractTemplate.builder()
                .name("표준 입양계약서")
                .description("반려동물 입양 시 사용하는 기본 계약서 템플릿입니다.")
                .category("입양계약서")
                .isDefault(true)
                .build();
        
        adoptionTemplate = contractTemplateRepository.save(adoptionTemplate);
        
        // 입양계약서 조항들
        List<ContractSection> adoptionSections = Arrays.asList(
            ContractSection.builder()
                .title("제1조 (목적)")
                .content("본 계약은 반려동물의 입양에 관한 당사자 간의 권리와 의무를 정함을 목적으로 한다.")
                .orderNum(1)
                .template(adoptionTemplate)
                .build(),
            ContractSection.builder()
                .title("제2조 (당사자)")
                .content("입양인: [입양인 정보]\n분양인: [분양인 정보]")
                .orderNum(2)
                .template(adoptionTemplate)
                .build(),
            ContractSection.builder()
                .title("제3조 (반려동물 정보)")
                .content("품종: [품종]\n나이: [나이]\n성별: [성별]\n특이사항: [특이사항]")
                .orderNum(3)
                .template(adoptionTemplate)
                .build(),
            ContractSection.builder()
                .title("제4조 (입양인의 의무)")
                .content("1. 반려동물을 가족의 일원으로 여기고 평생 책임지고 보호할 것\n2. 적절한 사료와 물을 제공하고 정기적인 건강검진을 받을 것\n3. 반려동물의 복지와 안전을 최우선으로 할 것")
                .orderNum(4)
                .template(adoptionTemplate)
                .build(),
            ContractSection.builder()
                .title("제5조 (분양인의 의무)")
                .content("1. 반려동물의 건강상태를 정확히 알려줄 것\n2. 입양 후 일정 기간 동안 상담과 지원을 제공할 것\n3. 반려동물의 과거 병력이나 특이사항을 숨기지 않을 것")
                .orderNum(5)
                .template(adoptionTemplate)
                .build(),
            ContractSection.builder()
                .title("제6조 (계약 해지)")
                .content("당사자 간 합의에 의하여 본 계약을 해지할 수 있다.")
                .orderNum(6)
                .template(adoptionTemplate)
                .build()
        );
        
        contractSectionRepository.saveAll(adoptionSections);
        
        // 분양계약서 템플릿
        ContractTemplate saleTemplate = ContractTemplate.builder()
                .name("표준 분양계약서")
                .description("반려동물 분양 시 사용하는 기본 계약서 템플릿입니다.")
                .category("분양계약서")
                .isDefault(true)
                .build();
        
        saleTemplate = contractTemplateRepository.save(saleTemplate);
        
        // 분양계약서 조항들
        List<ContractSection> saleSections = Arrays.asList(
            ContractSection.builder()
                .title("제1조 (목적)")
                .content("본 계약은 반려동물의 분양에 관한 당사자 간의 권리와 의무를 정함을 목적으로 한다.")
                .orderNum(1)
                .template(saleTemplate)
                .build(),
            ContractSection.builder()
                .title("제2조 (분양 대상)")
                .content("품종: [품종]\n나이: [나이]\n성별: [성별]\n분양가: [분양가]")
                .orderNum(2)
                .template(saleTemplate)
                .build(),
            ContractSection.builder()
                .title("제3조 (분양 조건)")
                .content("1. 분양희망자는 반려동물을 평생 책임지고 보호할 수 있는 환경을 갖추어야 함\n2. 분양 전 반려동물에 대한 충분한 이해와 준비가 필요함\n3. 분양 후 정기적인 소식 전달이 요구됨")
                .orderNum(3)
                .template(saleTemplate)
                .build(),
            ContractSection.builder()
                .title("제4조 (분양인의 의무)")
                .content("1. 반려동물의 건강상태를 정확히 알려줄 것\n2. 분양 후 일정 기간 동안 상담과 지원을 제공할 것\n3. 반려동물의 과거 병력이나 특이사항을 숨기지 않을 것")
                .orderNum(4)
                .template(saleTemplate)
                .build(),
            ContractSection.builder()
                .title("제5조 (분양희망자의 의무)")
                .content("1. 반려동물을 가족의 일원으로 여기고 평생 책임지고 보호할 것\n2. 적절한 사료와 물을 제공하고 정기적인 건강검진을 받을 것\n3. 반려동물의 복지와 안전을 최우선으로 할 것")
                .orderNum(5)
                .template(saleTemplate)
                .build(),
            ContractSection.builder()
                .title("제6조 (계약 해지)")
                .content("당사자 간 합의에 의하여 본 계약을 해지할 수 있다.")
                .orderNum(6)
                .template(saleTemplate)
                .build()
        );
        
        contractSectionRepository.saveAll(saleSections);
        
        log.info("기본 계약서 템플릿 생성 완료: {}개", contractTemplateRepository.count());
    }
} 